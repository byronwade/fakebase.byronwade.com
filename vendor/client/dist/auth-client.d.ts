/**
 * Auth client facade — wraps `kernel.auth` so callers get the familiar
 * `supabase.auth.signUp(...)` surface without touching the kernel directly.
 *
 * Unimplemented OAuth / passkey / MFA flows return a typed not-implemented
 * error rather than throwing, matching Supabase's error-first style.
 */
import { CapabilityError } from "@fakebase/core";
import type { FakebaseKernel, AuthEngine } from "@fakebase/core";
type NotImplementedResult = {
    data: null;
    error: CapabilityError;
};
/**
 * The `supabase.auth` facade. Extends the full {@link AuthEngine} contract with
 * the advanced flows Fakebase does not implement yet; those return a typed
 * {@link CapabilityError} instead of throwing.
 */
export interface AuthClientFacade extends AuthEngine {
    /** OAuth sign-in — not implemented; returns CapabilityError. */
    signInWithOAuth(params: {
        provider: string;
        options?: Record<string, unknown>;
    }): Promise<NotImplementedResult>;
    /** ID-token sign-in — not implemented; returns CapabilityError. */
    signInWithIdToken(params: Record<string, unknown>): Promise<NotImplementedResult>;
    /** Passkey / WebAuthn — not implemented; returns CapabilityError. */
    signInWithPasskey(params: Record<string, unknown>): Promise<NotImplementedResult>;
    /** SSO sign-in — not implemented; returns CapabilityError. */
    signInWithSSO(params: Record<string, unknown>): Promise<NotImplementedResult>;
    /** Resend OTP / confirmation — not implemented; returns CapabilityError. */
    resend(params: Record<string, unknown>): Promise<NotImplementedResult>;
    /** Refresh the current session token (delegates to setSession). */
    refreshSession(params?: {
        refresh_token?: string;
    }): ReturnType<AuthEngine["setSession"]>;
    /** MFA — not implemented; every method returns CapabilityError. */
    mfa: {
        enroll(params: Record<string, unknown>): Promise<NotImplementedResult>;
        challenge(params: Record<string, unknown>): Promise<NotImplementedResult>;
        verify(params: Record<string, unknown>): Promise<NotImplementedResult>;
        unenroll(params: Record<string, unknown>): Promise<NotImplementedResult>;
        listFactors(): Promise<NotImplementedResult>;
        getAuthenticatorAssuranceLevel(): Promise<NotImplementedResult>;
    };
}
/**
 * Build the `supabase.auth` facade object.
 * Implemented methods delegate to `kernel.auth`; advanced flows return a
 * `CapabilityError` without throwing.
 *
 * @param kernel - The kernel whose auth engine to wrap.
 */
export declare function createAuthClient(kernel: FakebaseKernel): AuthClientFacade;
export {};
//# sourceMappingURL=auth-client.d.ts.map