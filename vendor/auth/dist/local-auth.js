import { randomBytes, randomUUID } from "node:crypto";
function makeError(message) {
    return { data: null, error: { message } };
}
function ok(data) {
    return { data, error: null };
}
function generateId() {
    return randomUUID();
}
function generateToken(bytes = 32) {
    return randomBytes(bytes).toString("hex");
}
function now() {
    return new Date().toISOString();
}
function createSession(user, expiresIn = 3600) {
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
export class LocalAuthService {
    users;
    otpStore;
    storage;
    sessionKey;
    requireEmailConfirmation;
    callbacks = new Map();
    codeStore = new Map();
    otpInbox = [];
    /** Synchronous mirror of the persisted session for INITIAL_SESSION emission. */
    currentSession = null;
    constructor(users, otpStore, storage, options = {}) {
        this.users = users;
        this.otpStore = otpStore;
        this.storage = storage;
        this.sessionKey = options.sessionKey ?? "fakebase.auth.session";
        this.requireEmailConfirmation = options.requireEmailConfirmation ?? false;
    }
    emitAuthStateChange(event, session) {
        for (const cb of this.callbacks.values()) {
            cb(event, session);
        }
    }
    findUserByEmail(email) {
        for (const user of this.users.values()) {
            if (user.email === email)
                return user;
        }
        return undefined;
    }
    findUserByPhone(phone) {
        for (const user of this.users.values()) {
            if (user.phone === phone)
                return user;
        }
        return undefined;
    }
    async saveSession(session) {
        this.currentSession = session;
        await this.storage.setItem(this.sessionKey, JSON.stringify(session));
    }
    async signUp(params) {
        const existing = this.findUserByEmail(params.email);
        if (existing) {
            return {
                data: { user: null, session: null },
                error: { message: "User already registered" },
            };
        }
        const id = generateId();
        const n = now();
        const user = {
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
                data: { user, session: null, needsConfirmation: true },
                error: null,
            };
        }
        const session = createSession(user);
        await this.saveSession(session);
        this.emitAuthStateChange("SIGNED_IN", session);
        return ok({ user, session });
    }
    async signInWithPassword(params) {
        // Supabase returns `{ data: { user: null, session: null }, error }` on
        // failure (not `data: null`), so mirror that envelope here.
        const fail = (message) => ({
            data: { user: null, session: null },
            error: { message },
        });
        let user;
        if ("email" in params) {
            user = this.findUserByEmail(params.email);
        }
        else {
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
    async signInWithOtp(params) {
        const token = this.generateOtpToken();
        let otp;
        if ("email" in params) {
            otp = this.buildOtpRecord({ email: params.email, token, type: "email" });
        }
        else {
            otp = this.buildOtpRecord({ phone: params.phone, token, type: "sms" });
        }
        this.otpStore.set(otp.id, otp);
        this.otpInbox.push(otp);
        return ok({ user: null, session: null, messageId: otp.id });
    }
    async verifyOtp(params) {
        let record;
        for (const otp of this.otpStore.values()) {
            if (otp.token !== params.token || otp.type !== params.type)
                continue;
            if ("email" in params && otp.email !== params.email)
                continue;
            if ("phone" in params && otp.phone !== params.phone)
                continue;
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
        let user;
        if ("email" in params) {
            user = this.findUserByEmail(params.email);
            if (user && !user.emailConfirmedAt) {
                user.emailConfirmedAt = now();
                user.updatedAt = now();
                this.users.set(user.id, user);
            }
        }
        else {
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
    async getSession() {
        const raw = await this.storage.getItem(this.sessionKey);
        if (!raw)
            return ok({ session: null });
        try {
            const session = JSON.parse(raw);
            if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000)) {
                await this.storage.removeItem(this.sessionKey);
                return ok({ session: null });
            }
            return ok({ session });
        }
        catch {
            return ok({ session: null });
        }
    }
    async getUser(_jwt) {
        const { data } = await this.getSession();
        if (!data?.session)
            return ok({ user: null });
        const user = this.users.get(data.session.user.id) ?? null;
        return ok({ user });
    }
    async setSession(params) {
        const raw = await this.storage.getItem(this.sessionKey);
        if (raw) {
            try {
                const existing = JSON.parse(raw);
                if (existing.access_token === params.access_token &&
                    existing.refresh_token === params.refresh_token) {
                    return ok({ session: existing });
                }
            }
            catch {
                // ignore
            }
        }
        for (const user of this.users.values()) {
            if (user.deletedAt)
                continue;
            const session = {
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
    async exchangeCodeForSession(code) {
        const entry = this.codeStore.get(code);
        if (entry) {
            if (entry.expiresAt < Date.now()) {
                this.codeStore.delete(code);
                return makeError("Authorization code expired");
            }
            this.codeStore.delete(code);
            const user = this.users.get(entry.userId);
            if (!user)
                return makeError("User not found");
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
    async signOut(options) {
        void options;
        this.currentSession = null;
        await this.storage.removeItem(this.sessionKey);
        this.emitAuthStateChange("SIGNED_OUT", null);
        return { error: null };
    }
    onAuthStateChange(callback) {
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
    async updateUser(params) {
        const { data } = await this.getSession();
        if (!data?.session)
            return makeError("Not authenticated");
        const user = this.users.get(data.session.user.id);
        if (!user)
            return makeError("User not found");
        if (params.email)
            user.email = params.email;
        if (params.password)
            user.passwordHash = `dev:${params.password}`;
        if (params.data)
            user.userMetadata = { ...user.userMetadata, ...params.data };
        user.updatedAt = now();
        this.users.set(user.id, user);
        const updatedSession = { ...data.session, user };
        await this.saveSession(updatedSession);
        this.emitAuthStateChange("USER_UPDATED", updatedSession);
        return ok({ user });
    }
    async resetPasswordForEmail(email) {
        const user = this.findUserByEmail(email);
        if (!user)
            return { error: null }; // silently succeed per Supabase behavior
        const token = generateToken(16);
        const otp = this.buildOtpRecord({ email, token, type: "recovery" });
        this.otpStore.set(otp.id, otp);
        this.otpInbox.push(otp);
        this.emitAuthStateChange("PASSWORD_RECOVERY", null);
        return { error: null };
    }
    getOtpInbox() {
        return this.otpInbox.filter((r) => !r.used);
    }
    generateOtpToken() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    buildOtpRecord(params) {
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
    admin = {
        listUsers: (options = {}) => {
            const page = options.page ?? 1;
            const perPage = options.perPage ?? 50;
            const all = Array.from(this.users.values()).filter((u) => !u.deletedAt);
            const total = all.length;
            const users = all.slice((page - 1) * perPage, page * perPage);
            return ok({ users, total });
        },
        createUser: (params) => {
            const existing = this.findUserByEmail(params.email);
            if (existing)
                return makeError("User already exists");
            const id = generateId();
            const n = now();
            const user = {
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
        updateUserById: (id, params) => {
            const user = this.users.get(id);
            if (!user)
                return makeError("User not found");
            if (params.email !== undefined)
                user.email = params.email;
            if (params.password !== undefined)
                user.passwordHash = `dev:${params.password}`;
            if (params.userMetadata !== undefined)
                user.userMetadata = { ...user.userMetadata, ...params.userMetadata };
            if (params.appMetadata !== undefined)
                user.appMetadata = { ...user.appMetadata, ...params.appMetadata };
            if (params.role !== undefined)
                user.role = params.role;
            if (params.bannedUntil !== undefined)
                user.bannedUntil = params.bannedUntil;
            user.updatedAt = now();
            this.users.set(id, user);
            return ok({ user });
        },
        deleteUser: (id, options) => {
            const user = this.users.get(id);
            if (!user)
                return { error: { message: "User not found" } };
            if (options?.shouldSoftDelete) {
                user.deletedAt = now();
                user.updatedAt = now();
                this.users.set(id, user);
            }
            else {
                this.users.delete(id);
            }
            return { error: null };
        },
        getUserById: (id) => {
            const user = this.users.get(id);
            if (!user)
                return makeError("User not found");
            return ok({ user });
        },
        inviteUserByEmail: (email) => {
            const token = generateToken(16);
            const otp = this.buildOtpRecord({ email, token, type: "magic_link" });
            this.otpStore.set(otp.id, otp);
            this.otpInbox.push(otp);
            return ok({ user: null, messageId: otp.id });
        },
        generateLink: (opts) => {
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
    };
    // Expose codeStore for PKCE usage (e.g., from CLI)
    storeAuthCode(code, userId, ttlSeconds = 300) {
        this.codeStore.set(code, { userId, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
}
//# sourceMappingURL=local-auth.js.map