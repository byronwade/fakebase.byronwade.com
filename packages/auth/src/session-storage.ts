import type { SessionStorageAdapter } from "./types.js";

export class MemorySessionStorage implements SessionStorageAdapter {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
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

export class CookieSessionStorage implements SessionStorageAdapter {
  constructor(private readonly cookies: CookieAdapter) {}

  async getItem(key: string): Promise<string | null> {
    return this.cookies.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.cookies.set(key, value, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
    });
  }

  async removeItem(key: string): Promise<void> {
    this.cookies.remove(key, { path: "/", maxAge: 0 });
  }
}

interface BrowserLocalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getLocalStorage(): BrowserLocalStorage | null {
  const g = globalThis as { localStorage?: BrowserLocalStorage };
  return g.localStorage ?? null;
}

export class LocalStorageSessionStorage implements SessionStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    return getLocalStorage()?.getItem(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    getLocalStorage()?.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    getLocalStorage()?.removeItem(key);
  }
}
