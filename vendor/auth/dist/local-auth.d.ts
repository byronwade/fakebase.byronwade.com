import type { AuthEngine } from "@fakebase/core";
import type { LocalUser, LocalSession, SessionStorageAdapter, OtpRecord, AuthStateChangeEvent } from "./types.js";
type AuthStateCallback = (event: AuthStateChangeEvent["event"], session: LocalSession | null) => void;
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
type SignInWithPasswordParams = SignInWithPasswordEmailParams | SignInWithPasswordPhoneParams;
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
type AuthResult<T> = {
    data: T;
    error: null;
} | {
    data: null;
    error: {
        message: string;
    };
};
export interface LocalAuthServiceOptions {
    requireEmailConfirmation?: boolean;
    sessionKey?: string;
}
export declare class LocalAuthService implements AuthEngine {
    private readonly users;
    private readonly otpStore;
    private readonly storage;
    private readonly sessionKey;
    private readonly requireEmailConfirmation;
    private readonly callbacks;
    private readonly codeStore;
    private readonly otpInbox;
    /** Synchronous mirror of the persisted session for INITIAL_SESSION emission. */
    private currentSession;
    constructor(users: Map<string, LocalUser>, otpStore: Map<string, OtpRecord>, storage: SessionStorageAdapter, options?: LocalAuthServiceOptions);
    private emitAuthStateChange;
    private findUserByEmail;
    private findUserByPhone;
    private saveSession;
    signUp(params: SignUpParams): Promise<{
        data: {
            user: LocalUser;
            session: LocalSession;
        };
        error: null;
    } | {
        data: {
            user: LocalUser;
            session: null;
            needsConfirmation: true;
        };
        error: null;
    } | {
        data: {
            user: null;
            session: null;
        };
        error: {
            message: string;
        };
    }>;
    signInWithPassword(params: SignInWithPasswordParams): Promise<{
        data: {
            user: LocalUser;
            session: LocalSession;
        };
        error: null;
    } | {
        data: {
            user: null;
            session: null;
        };
        error: {
            message: string;
        };
    }>;
    signInWithOtp(params: SignInWithOtpParams): Promise<AuthResult<{
        user: null;
        session: null;
        messageId: string;
    }>>;
    verifyOtp(params: VerifyOtpParams): Promise<AuthResult<{
        user: LocalUser;
        session: LocalSession;
    }>>;
    getSession(): Promise<{
        data: {
            session: LocalSession | null;
        };
        error: null;
    }>;
    getUser(_jwt?: string): Promise<AuthResult<{
        user: LocalUser | null;
    }>>;
    setSession(params: {
        access_token: string;
        refresh_token: string;
    }): Promise<AuthResult<{
        session: LocalSession;
    }>>;
    exchangeCodeForSession(code: string): Promise<AuthResult<{
        session: LocalSession;
    }>>;
    signOut(options?: {
        scope?: "global" | "local" | "others";
    }): Promise<{
        error: null;
    }>;
    onAuthStateChange(callback: AuthStateCallback): {
        data: {
            subscription: {
                unsubscribe(): void;
            };
        };
        error: null;
    };
    updateUser(params: UpdateUserParams): Promise<AuthResult<{
        user: LocalUser;
    }>>;
    resetPasswordForEmail(email: string): Promise<{
        error: null;
    } | {
        error: {
            message: string;
        };
    }>;
    getOtpInbox(): OtpRecord[];
    private generateOtpToken;
    private buildOtpRecord;
    readonly admin: {
        readonly listUsers: (options?: AdminListUsersOptions) => AuthResult<{
            users: LocalUser[];
            total: number;
        }>;
        readonly createUser: (params: AdminCreateUserParams) => AuthResult<{
            user: LocalUser;
        }>;
        readonly updateUserById: (id: string, params: AdminUpdateUserParams) => AuthResult<{
            user: LocalUser;
        }>;
        readonly deleteUser: (id: string, options?: {
            shouldSoftDelete?: boolean;
        }) => {
            error: null;
        } | {
            error: {
                message: string;
            };
        };
        readonly getUserById: (id: string) => AuthResult<{
            user: LocalUser;
        }>;
        readonly inviteUserByEmail: (email: string) => AuthResult<{
            user: null;
            messageId: string;
        }>;
        readonly generateLink: (opts: GenerateLinkOptions) => AuthResult<{
            properties: {
                action_link: string;
                email: string;
                type: string;
            };
        }>;
    };
    storeAuthCode(code: string, userId: string, ttlSeconds?: number): void;
}
export {};
//# sourceMappingURL=local-auth.d.ts.map