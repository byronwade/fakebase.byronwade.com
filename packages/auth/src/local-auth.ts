import { randomBytes, randomUUID } from "node:crypto";
import type { AuthEngine } from "@byronwade/core";
import type {
  LocalUser,
  LocalSession,
  SessionStorageAdapter,
  OtpRecord,
  AuthStateChangeEvent,
} from "./types.js";

type AuthStateCallback = (
  event: AuthStateChangeEvent["event"],
  session: LocalSession | null,
) => void;

interface SignUpParams {
  email: string;
  password: string;
  userMetadata?: Record<string, unknown>;
}

interface SignInWithPasswordEmailParams {
  email: string;
  password: string;
}

interface SignInWithPasswordPhoneParams {
  phone: string;
  password: string;
}

type SignInWithPasswordParams =
  | SignInWithPasswordEmailParams
  | SignInWithPasswordPhoneParams;

interface SignInWithOtpEmailParams {
  email: string;
}

interface SignInWithOtpPhoneParams {
  phone: string;
}

type SignInWithOtpParams = SignInWithOtpEmailParams | SignInWithOtpPhoneParams;

interface VerifyOtpEmailParams {
  email: string;
  token: string;
  type: OtpRecord["type"];
}

interface VerifyOtpPhoneParams {
  phone: string;
  token: string;
  type: OtpRecord["type"];
}

type VerifyOtpParams = VerifyOtpEmailParams | VerifyOtpPhoneParams;

interface UpdateUserParams {
  email?: string;
  password?: string;
  data?: Record<string, unknown>;
}

interface AdminCreateUserParams {
  email: string;
  password?: string;
  emailConfirm?: boolean;
  userMetadata?: Record<string, unknown>;
}

interface AdminUpdateUserParams {
  email?: string;
  password?: string;
  userMetadata?: Record<string, unknown>;
  appMetadata?: Record<string, unknown>;
  role?: string;
  bannedUntil?: string | null;
}

interface AdminListUsersOptions {
  page?: number;
  perPage?: number;
}

interface GenerateLinkOptions {
  type: string;
  email: string;
}

type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

function makeError(message: string): { data: null; error: { message: string } } {
  return { data: null, error: { message } };
}

function ok<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

function generateId(): string {
  return randomUUID();
}

function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

function now(): string {
  return new Date().toISOString();
}

function createSession(user: LocalUser, expiresIn = 3600): LocalSession {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  return {
    access_token: generateToken(32),
    refresh_token: generateToken(32),
    token_type: "bearer",
    expires_in: expiresIn,
    expires_at: expiresAt,
    user,
  };
}

export interface LocalAuthServiceOptions {
  requireEmailConfirmation?: boolean;
  sessionKey?: string;
}

export class LocalAuthService implements AuthEngine {
  private readonly sessionKey: string;
  private readonly requireEmailConfirmation: boolean;
  private readonly callbacks = new Map<string, AuthStateCallback>();
  private readonly codeStore = new Map<string, { userId: string; expiresAt: number }>();
  private readonly otpInbox: OtpRecord[] = [];
  /** Synchronous mirror of the persisted session for INITIAL_SESSION emission. */
  private currentSession: LocalSession | null = null;

  constructor(
    private readonly users: Map<string, LocalUser>,
    private readonly otpStore: Map<string, OtpRecord>,
    private readonly storage: SessionStorageAdapter,
    options: LocalAuthServiceOptions = {},
  ) {
    this.sessionKey = options.sessionKey ?? "fakebase.auth.session";
    this.requireEmailConfirmation = options.requireEmailConfirmation ?? false;
  }

  private emitAuthStateChange(
    event: AuthStateChangeEvent["event"],
    session: LocalSession | null,
  ): void {
    for (const cb of this.callbacks.values()) {
      cb(event, session);
    }
  }

  private findUserByEmail(email: string): LocalUser | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  private findUserByPhone(phone: string): LocalUser | undefined {
    for (const user of this.users.values()) {
      if (user.phone === phone) return user;
    }
    return undefined;
  }

  private async saveSession(session: LocalSession): Promise<void> {
    this.currentSession = session;
    await this.storage.setItem(this.sessionKey, JSON.stringify(session));
  }

  async signUp(
    params: SignUpParams,
  ): Promise<
    | { data: { user: LocalUser; session: LocalSession }; error: null }
    | { data: { user: LocalUser; session: null; needsConfirmation: true }; error: null }
    | { data: { user: null; session: null }; error: { message: string } }
  > {
    const existing = this.findUserByEmail(params.email);
    if (existing) {
      return {
        data: { user: null, session: null },
        error: { message: "User already registered" },
      };
    }

    const id = generateId();
    const n = now();
    const user: LocalUser = {
      id,
      email: params.email,
      passwordHash: `dev:${params.password}`,
      emailConfirmedAt: this.requireEmailConfirmation ? null : n,
      phoneConfirmedAt: null,
      userMetadata: params.userMetadata ?? {},
      appMetadata: {},
      role: "authenticated",
      createdAt: n,
      updatedAt: n,
      bannedUntil: null,
      deletedAt: null,
    };

    this.users.set(id, user);

    if (this.requireEmailConfirmation) {
      const otpToken = this.generateOtpToken();
      const otp = this.buildOtpRecord({
        email: params.email,
        token: otpToken,
        type: "email",
      });
      this.otpStore.set(otp.id, otp);
      this.otpInbox.push(otp);
      return {
        data: { user, session: null, needsConfirmation: true as const },
        error: null,
      };
    }

    const session = createSession(user);
    await this.saveSession(session);
    this.emitAuthStateChange("SIGNED_IN", session);
    return ok({ user, session });
  }

  async signInWithPassword(
    params: SignInWithPasswordParams,
  ): Promise<
    | { data: { user: LocalUser; session: LocalSession }; error: null }
    | { data: { user: null; session: null }; error: { message: string } }
  > {
    // Supabase returns `{ data: { user: null, session: null }, error }` on
    // failure (not `data: null`), so mirror that envelope here.
    const fail = (message: string) => ({
      data: { user: null, session: null },
      error: { message },
    });

    let user: LocalUser | undefined;

    if ("email" in params) {
      user = this.findUserByEmail(params.email);
    } else {
      user = this.findUserByPhone(params.phone);
    }

    if (!user) {
      return fail("Invalid login credentials");
    }

    if (user.deletedAt) {
      return fail("User account has been deleted");
    }

    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      return fail("User account is banned");
    }

    if (user.passwordHash !== `dev:${params.password}`) {
      return fail("Invalid login credentials");
    }

    if (this.requireEmailConfirmation && !user.emailConfirmedAt) {
      return fail("Email not confirmed");
    }

    const session = createSession(user);
    await this.saveSession(session);
    this.emitAuthStateChange("SIGNED_IN", session);
    return ok({ user, session });
  }

  async signInWithOtp(
    params: SignInWithOtpParams,
  ): Promise<AuthResult<{ user: null; session: null; messageId: string }>> {
    const token = this.generateOtpToken();
    let otp: OtpRecord;

    if ("email" in params) {
      otp = this.buildOtpRecord({ email: params.email, token, type: "email" });
    } else {
      otp = this.buildOtpRecord({ phone: params.phone, token, type: "sms" });
    }

    this.otpStore.set(otp.id, otp);
    this.otpInbox.push(otp);

    return ok({ user: null, session: null, messageId: otp.id });
  }

  async verifyOtp(
    params: VerifyOtpParams,
  ): Promise<AuthResult<{ user: LocalUser; session: LocalSession }>> {
    let record: OtpRecord | undefined;

    for (const otp of this.otpStore.values()) {
      if (otp.token !== params.token || otp.type !== params.type) continue;
      if ("email" in params && otp.email !== params.email) continue;
      if ("phone" in params && otp.phone !== params.phone) continue;
      record = otp;
      break;
    }

    if (!record) {
      return makeError("Token not found");
    }

    if (record.used) {
      return makeError("Token already used");
    }

    if (new Date(record.expiresAt) < new Date()) {
      return makeError("Token expired");
    }

    record.used = true;
    this.otpStore.set(record.id, record);

    let user: LocalUser | undefined;
    if ("email" in params) {
      user = this.findUserByEmail(params.email);
      if (user && !user.emailConfirmedAt) {
        user.emailConfirmedAt = now();
        user.updatedAt = now();
        this.users.set(user.id, user);
      }
    } else {
      user = this.findUserByPhone(params.phone);
      if (user && !user.phoneConfirmedAt) {
        user.phoneConfirmedAt = now();
        user.updatedAt = now();
        this.users.set(user.id, user);
      }
    }

    if (!user) {
      return makeError("User not found");
    }

    const session = createSession(user);
    await this.saveSession(session);
    this.emitAuthStateChange("SIGNED_IN", session);
    return ok({ user, session });
  }

  async getSession(): Promise<{ data: { session: LocalSession | null }; error: null }> {
    const raw = await this.storage.getItem(this.sessionKey);
    if (!raw) return ok({ session: null });

    try {
      const session = JSON.parse(raw) as LocalSession;
      if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
        await this.storage.removeItem(this.sessionKey);
        return ok({ session: null });
      }
      return ok({ session });
    } catch {
      return ok({ session: null });
    }
  }

  async getUser(_jwt?: string): Promise<AuthResult<{ user: LocalUser | null }>> {
    const { data } = await this.getSession();
    if (!data?.session) return ok({ user: null });
    const user = this.users.get(data.session.user.id) ?? null;
    return ok({ user });
  }

  async setSession(params: {
    access_token: string;
    refresh_token: string;
  }): Promise<AuthResult<{ session: LocalSession }>> {
    const raw = await this.storage.getItem(this.sessionKey);
    if (raw) {
      try {
        const existing = JSON.parse(raw) as LocalSession;
        if (
          existing.access_token === params.access_token &&
          existing.refresh_token === params.refresh_token
        ) {
          return ok({ session: existing });
        }
      } catch {
        // ignore
      }
    }

    for (const user of this.users.values()) {
      if (user.deletedAt) continue;
      const session: LocalSession = {
        access_token: params.access_token,
        refresh_token: params.refresh_token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      };
      await this.saveSession(session);
      this.emitAuthStateChange("TOKEN_REFRESHED", session);
      return ok({ session });
    }

    return makeError("No users available to restore session");
  }

  async exchangeCodeForSession(
    code: string,
  ): Promise<AuthResult<{ session: LocalSession }>> {
    const entry = this.codeStore.get(code);

    if (entry) {
      if (entry.expiresAt < Date.now()) {
        this.codeStore.delete(code);
        return makeError("Authorization code expired");
      }
      this.codeStore.delete(code);
      const user = this.users.get(entry.userId);
      if (!user) return makeError("User not found");
      const session = createSession(user);
      await this.saveSession(session);
      this.emitAuthStateChange("SIGNED_IN", session);
      return ok({ session });
    }

    // Dev convenience: accept raw user ID as code
    const user = this.users.get(code);
    if (user) {
      const session = createSession(user);
      await this.saveSession(session);
      this.emitAuthStateChange("SIGNED_IN", session);
      return ok({ session });
    }

    return makeError("Invalid authorization code");
  }

  async signOut(options?: {
    scope?: "global" | "local" | "others";
  }): Promise<{ error: null }> {
    void options;
    this.currentSession = null;
    await this.storage.removeItem(this.sessionKey);
    this.emitAuthStateChange("SIGNED_OUT", null);
    return { error: null };
  }

  onAuthStateChange(callback: AuthStateCallback): {
    data: { subscription: { unsubscribe(): void } };
    error: null;
  } {
    const id = generateId();
    this.callbacks.set(id, callback);

    // Mirror Supabase: emit an INITIAL_SESSION event on the next microtask with
    // the current session, unless the listener was synchronously unsubscribed.
    queueMicrotask(() => {
      if (this.callbacks.has(id)) {
        callback("INITIAL_SESSION", this.currentSession);
      }
    });

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.callbacks.delete(id);
          },
        },
      },
      error: null,
    };
  }

  async updateUser(params: UpdateUserParams): Promise<AuthResult<{ user: LocalUser }>> {
    const { data } = await this.getSession();
    if (!data?.session) return makeError("Not authenticated");

    const user = this.users.get(data.session.user.id);
    if (!user) return makeError("User not found");

    if (params.email) user.email = params.email;
    if (params.password) user.passwordHash = `dev:${params.password}`;
    if (params.data) user.userMetadata = { ...user.userMetadata, ...params.data };
    user.updatedAt = now();

    this.users.set(user.id, user);

    const updatedSession: LocalSession = { ...data.session, user };
    await this.saveSession(updatedSession);
    this.emitAuthStateChange("USER_UPDATED", updatedSession);

    return ok({ user });
  }

  async resetPasswordForEmail(
    email: string,
  ): Promise<{ error: null } | { error: { message: string } }> {
    const user = this.findUserByEmail(email);
    if (!user) return { error: null }; // silently succeed per Supabase behavior

    const token = generateToken(16);
    const otp = this.buildOtpRecord({ email, token, type: "recovery" });
    this.otpStore.set(otp.id, otp);
    this.otpInbox.push(otp);

    this.emitAuthStateChange("PASSWORD_RECOVERY", null);
    return { error: null };
  }

  getOtpInbox(): OtpRecord[] {
    return this.otpInbox.filter((r) => !r.used);
  }

  private generateOtpToken(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private buildOtpRecord(params: {
    email?: string;
    phone?: string;
    token: string;
    type: OtpRecord["type"];
  }): OtpRecord {
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);
    return {
      id: generateId(),
      email: params.email,
      phone: params.phone,
      token: params.token,
      type: params.type,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
    };
  }

  readonly admin = {
    listUsers: (
      options: AdminListUsersOptions = {},
    ): AuthResult<{ users: LocalUser[]; total: number }> => {
      const page = options.page ?? 1;
      const perPage = options.perPage ?? 50;
      const all = Array.from(this.users.values()).filter((u) => !u.deletedAt);
      const total = all.length;
      const users = all.slice((page - 1) * perPage, page * perPage);
      return ok({ users, total });
    },

    createUser: (params: AdminCreateUserParams): AuthResult<{ user: LocalUser }> => {
      const existing = this.findUserByEmail(params.email);
      if (existing) return makeError("User already exists");

      const id = generateId();
      const n = now();
      const user: LocalUser = {
        id,
        email: params.email,
        passwordHash: params.password ? `dev:${params.password}` : "",
        emailConfirmedAt: params.emailConfirm ? n : null,
        phoneConfirmedAt: null,
        userMetadata: params.userMetadata ?? {},
        appMetadata: {},
        role: "authenticated",
        createdAt: n,
        updatedAt: n,
        bannedUntil: null,
        deletedAt: null,
      };
      this.users.set(id, user);
      return ok({ user });
    },

    updateUserById: (
      id: string,
      params: AdminUpdateUserParams,
    ): AuthResult<{ user: LocalUser }> => {
      const user = this.users.get(id);
      if (!user) return makeError("User not found");

      if (params.email !== undefined) user.email = params.email;
      if (params.password !== undefined) user.passwordHash = `dev:${params.password}`;
      if (params.userMetadata !== undefined)
        user.userMetadata = { ...user.userMetadata, ...params.userMetadata };
      if (params.appMetadata !== undefined)
        user.appMetadata = { ...user.appMetadata, ...params.appMetadata };
      if (params.role !== undefined) user.role = params.role;
      if (params.bannedUntil !== undefined) user.bannedUntil = params.bannedUntil;
      user.updatedAt = now();

      this.users.set(id, user);
      return ok({ user });
    },

    deleteUser: (
      id: string,
      options?: { shouldSoftDelete?: boolean },
    ): { error: null } | { error: { message: string } } => {
      const user = this.users.get(id);
      if (!user) return { error: { message: "User not found" } };

      if (options?.shouldSoftDelete) {
        user.deletedAt = now();
        user.updatedAt = now();
        this.users.set(id, user);
      } else {
        this.users.delete(id);
      }
      return { error: null };
    },

    getUserById: (id: string): AuthResult<{ user: LocalUser }> => {
      const user = this.users.get(id);
      if (!user) return makeError("User not found");
      return ok({ user });
    },

    inviteUserByEmail: (
      email: string,
    ): AuthResult<{ user: null; messageId: string }> => {
      const token = generateToken(16);
      const otp = this.buildOtpRecord({ email, token, type: "magic_link" });
      this.otpStore.set(otp.id, otp);
      this.otpInbox.push(otp);
      return ok({ user: null, messageId: otp.id });
    },

    generateLink: (
      opts: GenerateLinkOptions,
    ): AuthResult<{
      properties: { action_link: string; email: string; type: string };
    }> => {
      const token = generateToken(16);
      const otp = this.buildOtpRecord({
        email: opts.email,
        token,
        type: opts.type === "recovery" ? "recovery" : "magic_link",
      });
      this.otpStore.set(otp.id, otp);
      this.otpInbox.push(otp);

      const actionLink = `http://localhost:54321/auth/v1/verify?token=${token}&type=${opts.type}&redirect_to=http://localhost:3000`;
      return ok({
        properties: {
          action_link: actionLink,
          email: opts.email,
          type: opts.type,
        },
      });
    },
  } as const;

  // Expose codeStore for PKCE usage (e.g., from CLI)
  storeAuthCode(code: string, userId: string, ttlSeconds = 300): void {
    this.codeStore.set(code, { userId, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}
