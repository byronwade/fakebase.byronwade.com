import { randomBytes, createHash } from "node:crypto";

export function generateCodeVerifier(): string {
  const length = 64;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i]! % chars.length];
  }
  return result;
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash("sha256").update(verifier).digest();
  return Buffer.from(hash)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function generateAuthCode(): string {
  return randomBytes(16).toString("hex");
}

export class PkceStore {
  private store = new Map<string, { userId: string; expiresAt: number }>();

  set(code: string, userId: string, ttlSeconds = 300): void {
    this.store.set(code, { userId, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  consume(code: string): string | null {
    const entry = this.store.get(code);
    if (!entry) return null;
    this.store.delete(code);
    if (entry.expiresAt < Date.now()) return null;
    return entry.userId;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [code, entry] of this.store.entries()) {
      if (entry.expiresAt < now) {
        this.store.delete(code);
      }
    }
  }
}
