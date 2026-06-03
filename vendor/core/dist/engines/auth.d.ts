/**
 * Auth engine contract and canonical value types.
 *
 * The concrete implementation lives in `@fakebase/auth` (`LocalAuthService`),
 * but the value types and the `AuthEngine` interface are defined here so the
 * kernel and the client auth facade can depend on a stable contract without a
 * circular dependency.
 */
/** A local user record, shaped like a row of Supabase's `auth.users`. */
export interface AuthUser {
    id: string;
    email: string;
    phone?: string;
    /** Dev-only password marker (`dev:<password>`). Never a real hash. */
    passwordHash: string;
    emailConfirmedAt: string | null;
    phoneConfirmedAt: string | null;
    userMetadata: Record<string, unknown>;
    appMetadata: Record<string, unknown>;
    role: string;
    createdAt: string;
    updatedAt: string;
    bannedUntil: string | null;
    deletedAt: string | null;
}
/** A local session, shaped like a Supabase auth session. */
export interface AuthSession {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    expires_at: number;
    user: AuthUser;
}
/** Events emitted to `onAuthStateChange` subscribers. */
export type AuthChangeEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED" | "PASSWORD_RECOVERY";
/** A pending OTP / magic-link / recovery token kept in the local inbox. */
export interface OtpRecord {
    id: string;
    email?: string;
    phone?: string;
    token: string;
    type: "email" | "sms" | "magic_link" | "recovery";
    createdAt: string;
    expiresAt: string;
    used: boolean;
}
/** Pluggable session persistence (memory, cookie, localStorage). */
export interface SessionStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
/** Internal auth result envelope used by the engine (adapted by the facade). */
export type AuthResult<T> = {
    data: T;
    error: null;
} | {
    data: null;
    error: {
        message: string;
    };
};
type AuthCallback = (event: AuthChangeEvent, session: AuthSession | null) => void;
/** Admin sub-API mirroring `supabase.auth.admin`. */
export interface AuthAdminApi {
    listUsers(options?: {
        page?: number;
        perPage?: number;
    }): AuthResult<{
        users: AuthUser[];
        total: number;
    }>;
    createUser(params: {
        email: string;
        password?: string;
        emailConfirm?: boolean;
        userMetadata?: Record<string, unknown>;
    }): AuthResult<{
        user: AuthUser;
    }>;
    updateUserById(id: string, params: {
        email?: string;
        password?: string;
        userMetadata?: Record<string, unknown>;
        appMetadata?: Record<string, unknown>;
        role?: string;
        bannedUntil?: string | null;
    }): AuthResult<{
        user: AuthUser;
    }>;
    deleteUser(id: string, options?: {
        shouldSoftDelete?: boolean;
    }): {
        error: null;
    } | {
        error: {
            message: string;
        };
    };
    getUserById(id: string): AuthResult<{
        user: AuthUser;
    }>;
    inviteUserByEmail(email: string): AuthResult<{
        user: null;
        messageId: string;
    }>;
    generateLink(opts: {
        type: string;
        email: string;
    }): AuthResult<{
        properties: {
            action_link: string;
            email: string;
            type: string;
        };
    }>;
}
/**
 * The auth engine contract consumed by the kernel and the client auth facade.
 * `LocalAuthService` in `@fakebase/auth` implements this interface.
 */
export interface AuthEngine {
    signUp(params: {
        email: string;
        password: string;
        userMetadata?: Record<string, unknown>;
    }): Promise<{
        data: {
            user: AuthUser;
            session: AuthSession;
        };
        error: null;
    } | {
        data: {
            user: AuthUser;
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
    signInWithPassword(params: {
        email: string;
        password: string;
    } | {
        phone: string;
        password: string;
    }): Promise<{
        data: {
            user: AuthUser;
            session: AuthSession;
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
    signInWithOtp(params: {
        email: string;
    } | {
        phone: string;
    }): Promise<AuthResult<{
        user: null;
        session: null;
        messageId: string;
    }>>;
    verifyOtp(params: {
        email: string;
        token: string;
        type: OtpRecord["type"];
    } | {
        phone: string;
        token: string;
        type: OtpRecord["type"];
    }): Promise<AuthResult<{
        user: AuthUser;
        session: AuthSession;
    }>>;
    getSession(): Promise<{
        data: {
            session: AuthSession | null;
        };
        error: null;
    }>;
    getUser(jwt?: string): Promise<AuthResult<{
        user: AuthUser | null;
    }>>;
    setSession(params: {
        access_token: string;
        refresh_token: string;
    }): Promise<AuthResult<{
        session: AuthSession;
    }>>;
    exchangeCodeForSession(code: string): Promise<AuthResult<{
        session: AuthSession;
    }>>;
    signOut(options?: {
        scope?: "global" | "local" | "others";
    }): Promise<{
        error: null;
    }>;
    onAuthStateChange(callback: AuthCallback): {
        data: {
            subscription: {
                unsubscribe(): void;
            };
        };
        error: null;
    };
    updateUser(params: {
        email?: string;
        password?: string;
        data?: Record<string, unknown>;
    }): Promise<AuthResult<{
        user: AuthUser;
    }>>;
    resetPasswordForEmail(email: string): Promise<{
        error: null;
    } | {
        error: {
            message: string;
        };
    }>;
    getOtpInbox(): OtpRecord[];
    readonly admin: AuthAdminApi;
}
export {};
//# sourceMappingURL=auth.d.ts.map