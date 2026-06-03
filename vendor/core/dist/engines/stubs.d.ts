/**
 * Stub auth/storage engines used by a bare kernel until a real engine is
 * attached (via `kernel.useAuth` / `kernel.useStorage`, or `createMemoryKernel`).
 *
 * Every method returns a structured "not configured" error rather than throwing
 * or silently succeeding, matching Fakebase's capability-error contract.
 */
import type { AuthEngine, AuthAdminApi } from "./auth.js";
import type { StorageEngine, StorageBucketApi } from "./storage.js";
/** No-op auth engine that reports it is not configured. */
export declare class StubAuthEngine implements AuthEngine {
    signUp(): Promise<{
        readonly data: {
            readonly user: null;
            readonly session: null;
        };
        readonly error: {
            readonly message: "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
        };
    }>;
    signInWithPassword(): Promise<{
        readonly data: {
            readonly user: null;
            readonly session: null;
        };
        readonly error: {
            readonly message: "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
        };
    }>;
    signInWithOtp(): Promise<{
        readonly data: null;
        readonly error: {
            readonly message: "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
        };
    }>;
    verifyOtp(): Promise<{
        readonly data: null;
        readonly error: {
            readonly message: "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
        };
    }>;
    getSession(): Promise<{
        readonly data: {
            readonly session: null;
        };
        readonly error: null;
    }>;
    getUser(): Promise<{
        readonly data: {
            readonly user: null;
        };
        readonly error: null;
    }>;
    setSession(): Promise<{
        readonly data: null;
        readonly error: {
            readonly message: "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
        };
    }>;
    exchangeCodeForSession(): Promise<{
        readonly data: null;
        readonly error: {
            readonly message: "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
        };
    }>;
    signOut(): Promise<{
        readonly error: null;
    }>;
    onAuthStateChange(): {
        readonly data: {
            readonly subscription: {
                readonly unsubscribe: () => void;
            };
        };
        readonly error: null;
    };
    updateUser(): Promise<{
        readonly data: null;
        readonly error: {
            readonly message: "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
        };
    }>;
    resetPasswordForEmail(): Promise<{
        readonly error: null;
    }>;
    getOtpInbox(): never[];
    readonly admin: AuthAdminApi;
}
/** No-op storage engine that reports it is not configured. */
export declare class StubStorageEngine implements StorageEngine {
    listBuckets(): {
        readonly data: null;
        readonly error: {
            readonly message: "Storage engine not configured. Use createMemoryKernel() or kernel.useStorage(new LocalStorageService(...)).";
        };
    };
    createBucket(): {
        readonly data: null;
        readonly error: {
            readonly message: "Storage engine not configured. Use createMemoryKernel() or kernel.useStorage(new LocalStorageService(...)).";
        };
    };
    getBucket(): {
        readonly data: null;
        readonly error: {
            readonly message: "Storage engine not configured. Use createMemoryKernel() or kernel.useStorage(new LocalStorageService(...)).";
        };
    };
    updateBucket(): {
        readonly data: null;
        readonly error: {
            readonly message: "Storage engine not configured. Use createMemoryKernel() or kernel.useStorage(new LocalStorageService(...)).";
        };
    };
    deleteBucket(): Promise<{
        readonly data: null;
        readonly error: {
            readonly message: "Storage engine not configured. Use createMemoryKernel() or kernel.useStorage(new LocalStorageService(...)).";
        };
    }>;
    emptyBucket(): Promise<{
        readonly data: null;
        readonly error: {
            readonly message: "Storage engine not configured. Use createMemoryKernel() or kernel.useStorage(new LocalStorageService(...)).";
        };
    }>;
    from(): StorageBucketApi;
    verifySignedUrl(): null;
}
//# sourceMappingURL=stubs.d.ts.map