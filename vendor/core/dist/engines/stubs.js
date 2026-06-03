/**
 * Stub auth/storage engines used by a bare kernel until a real engine is
 * attached (via `kernel.useAuth` / `kernel.useStorage`, or `createMemoryKernel`).
 *
 * Every method returns a structured "not configured" error rather than throwing
 * or silently succeeding, matching Fakebase's capability-error contract.
 */
const AUTH_MSG = "Auth engine not configured. Use createMemoryKernel() or kernel.useAuth(new LocalAuthService(...)).";
const STORAGE_MSG = "Storage engine not configured. Use createMemoryKernel() or kernel.useStorage(new LocalStorageService(...)).";
function authErr() {
    return { data: null, error: { message: AUTH_MSG } };
}
function storageErr() {
    return { data: null, error: { message: STORAGE_MSG } };
}
const stubAdmin = {
    listUsers: () => authErr(),
    createUser: () => authErr(),
    updateUserById: () => authErr(),
    deleteUser: () => ({ error: { message: AUTH_MSG } }),
    getUserById: () => authErr(),
    inviteUserByEmail: () => authErr(),
    generateLink: () => authErr(),
};
/** No-op auth engine that reports it is not configured. */
export class StubAuthEngine {
    async signUp() {
        return {
            data: { user: null, session: null },
            error: { message: AUTH_MSG },
        };
    }
    async signInWithPassword() {
        return {
            data: { user: null, session: null },
            error: { message: AUTH_MSG },
        };
    }
    async signInWithOtp() {
        return authErr();
    }
    async verifyOtp() {
        return authErr();
    }
    async getSession() {
        return { data: { session: null }, error: null };
    }
    async getUser() {
        return { data: { user: null }, error: null };
    }
    async setSession() {
        return authErr();
    }
    async exchangeCodeForSession() {
        return authErr();
    }
    async signOut() {
        return { error: null };
    }
    onAuthStateChange() {
        return { data: { subscription: { unsubscribe() { } } }, error: null };
    }
    async updateUser() {
        return authErr();
    }
    async resetPasswordForEmail() {
        return { error: null };
    }
    getOtpInbox() {
        return [];
    }
    admin = stubAdmin;
}
const stubBucketApi = {
    upload: async () => storageErr(),
    update: async () => storageErr(),
    move: async () => storageErr(),
    copy: async () => storageErr(),
    remove: async () => storageErr(),
    list: () => storageErr(),
    download: async () => storageErr(),
    getPublicUrl: () => ({ data: { publicUrl: "" } }),
    createSignedUrl: async () => storageErr(),
    createSignedUrls: async () => storageErr(),
    createSignedUploadUrl: async () => storageErr(),
    info: () => storageErr(),
};
/** No-op storage engine that reports it is not configured. */
export class StubStorageEngine {
    listBuckets() {
        return storageErr();
    }
    createBucket() {
        return storageErr();
    }
    getBucket() {
        return storageErr();
    }
    updateBucket() {
        return storageErr();
    }
    async deleteBucket() {
        return storageErr();
    }
    async emptyBucket() {
        return storageErr();
    }
    from() {
        return stubBucketApi;
    }
    verifySignedUrl() {
        return null;
    }
}
//# sourceMappingURL=stubs.js.map