/**
 * Auth client facade — wraps `kernel.auth` so callers get the familiar
 * `supabase.auth.signUp(...)` surface without touching the kernel directly.
 *
 * Unimplemented OAuth / passkey / MFA flows return a typed not-implemented
 * error rather than throwing, matching Supabase's error-first style.
 */

import { CapabilityError } from "@byronwade/core";
import type { FakebaseKernel, AuthEngine } from "@byronwade/core";

type NotImplementedResult = { data: null; error: CapabilityError };

function notImplemented(method: string): NotImplementedResult {
  return {
    data: null,
    error: CapabilityError.notImplemented(`auth.${method}`),
  };
}

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
export function createAuthClient(kernel: FakebaseKernel): AuthClientFacade {
  const auth = kernel.auth;

  return {
    // Fully delegated AuthEngine surface
    signUp: (p) => auth.signUp(p),
    signInWithPassword: (p) => auth.signInWithPassword(p),
    signInWithOtp: (p) => auth.signInWithOtp(p),
    verifyOtp: (p) => auth.verifyOtp(p),
    getSession: () => auth.getSession(),
    getUser: (jwt) => auth.getUser(jwt),
    setSession: (t) => auth.setSession(t),
    exchangeCodeForSession: (c) => auth.exchangeCodeForSession(c),
    signOut: (o) => auth.signOut(o),
    onAuthStateChange: (cb) => auth.onAuthStateChange(cb),
    updateUser: (attrs) => auth.updateUser(attrs),
    resetPasswordForEmail: (email) => auth.resetPasswordForEmail(email),
    getOtpInbox: () => auth.getOtpInbox(),
    admin: auth.admin,

    // Convenience alias
    refreshSession: (params) =>
      auth.setSession({
        access_token: params?.refresh_token ?? "",
        refresh_token: params?.refresh_token ?? "",
      }),

    // Capability-gated flows
    signInWithOAuth: async (_p) => notImplemented("signInWithOAuth"),
    signInWithIdToken: async (_p) => notImplemented("signInWithIdToken"),
    signInWithPasskey: async (_p) => notImplemented("signInWithPasskey"),
    signInWithSSO: async (_p) => notImplemented("signInWithSSO"),
    resend: async (_p) => notImplemented("resend"),

    mfa: {
      enroll: async (_p) => notImplemented("mfa.enroll"),
      challenge: async (_p) => notImplemented("mfa.challenge"),
      verify: async (_p) => notImplemented("mfa.verify"),
      unenroll: async (_p) => notImplemented("mfa.unenroll"),
      listFactors: async () => notImplemented("mfa.listFactors"),
      getAuthenticatorAssuranceLevel: async () =>
        notImplemented("mfa.getAuthenticatorAssuranceLevel"),
    },
  };
}
