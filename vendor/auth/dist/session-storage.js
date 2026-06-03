export class MemorySessionStorage {
    store = new Map();
    async getItem(key) {
        return this.store.get(key) ?? null;
    }
    async setItem(key, value) {
        this.store.set(key, value);
    }
    async removeItem(key) {
        this.store.delete(key);
    }
}
export class CookieSessionStorage {
    cookies;
    constructor(cookies) {
        this.cookies = cookies;
    }
    async getItem(key) {
        return this.cookies.get(key) ?? null;
    }
    async setItem(key, value) {
        this.cookies.set(key, value, {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
            httpOnly: true,
            secure: process.env["NODE_ENV"] === "production",
        });
    }
    async removeItem(key) {
        this.cookies.remove(key, { path: "/", maxAge: 0 });
    }
}
function getLocalStorage() {
    const g = globalThis;
    return g.localStorage ?? null;
}
export class LocalStorageSessionStorage {
    async getItem(key) {
        return getLocalStorage()?.getItem(key) ?? null;
    }
    async setItem(key, value) {
        getLocalStorage()?.setItem(key, value);
    }
    async removeItem(key) {
        getLocalStorage()?.removeItem(key);
    }
}
//# sourceMappingURL=session-storage.js.map