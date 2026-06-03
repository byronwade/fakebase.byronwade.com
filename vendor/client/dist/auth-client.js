/**
 * Auth client facade — wraps `kernel.auth` so callers get the familiar
 * `supabase.auth.signUp(...)` surface without touching the kernel directly.
 *
 * Unimplemented OAuth / passkey / MFA flows return a typed not-implemented
 * error rather than throwing, matching Supabase's error-first style.
 */
import { CapabilityError } from "@fakebase/core";
function notImplemented(method) {
    return {
        data: null,
        error: CapabilityError.notImplemented(`auth.${method}`),
    };
}
/**
 * Build the `supabase.auth` facade object.
 * Implemented methods delegate to `kernel.auth`; advanced flows return a
 * `CapabilityError` without throwing.
 *
 * @param kernel - The kernel whose auth engine to wrap.
 */
export function createAuthClient(kernel) {
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
        refreshSession: (params) => auth.setSession({
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
            getAuthenticatorAssuranceLevel: async () => notImplemented("mfa.getAuthenticatorAssuranceLevel"),
        },
    };
}
//# sourceMappingURL=auth-client.js.map