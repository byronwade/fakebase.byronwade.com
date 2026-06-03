import type { SessionStorageAdapter } from "./types.js";
export declare class MemorySessionStorage implements SessionStorageAdapter {
    private store;
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
export interface CookieSerializeOptions {
    path?: string;
    maxAge?: number;
    domain?: string;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none" | boolean;
    httpOnly?: boolean;
}
export interface CookieAdapter {
    get: (name: string) => string | undefined;
    set: (name: string, value: string, options: CookieSerializeOptions) => void;
    remove: (name: string, options: CookieSerializeOptions) => void;
}
export declare class CookieSessionStorage implements SessionStorageAdapter {
    private readonly cookies;
    constructor(cookies: CookieAdapter);
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
export declare class LocalStorageSessionStorage implements SessionStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
}
//# sourceMappingURL=session-storage.d.ts.map