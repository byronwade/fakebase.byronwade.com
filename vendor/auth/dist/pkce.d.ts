export declare function generateCodeVerifier(): string;
export declare function generateCodeChallenge(verifier: string): Promise<string>;
export declare function generateAuthCode(): string;
export declare class PkceStore {
    private store;
    set(code: string, userId: string, ttlSeconds?: number): void;
    consume(code: string): string | null;
    cleanup(): void;
}
//# sourceMappingURL=pkce.d.ts.map