import { describe, it, expect } from "vitest";
import { LocalAuthService } from "../local-auth.js";
import { MemorySessionStorage } from "../session-storage.js";
function makeAuth(options) {
    const users = new Map();
    const otpStore = new Map();
    const storage = new MemorySessionStorage();
    const auth = new LocalAuthService(users, otpStore, storage, options);
    return { auth, users, otpStore, storage };
}
describe("LocalAuthService", () => {
    describe("signUp", () => {
        it("creates a new user and session when email confirmation is not required", async () => {
            const { auth } = makeAuth({ requireEmailConfirmation: false });
            const result = await auth.signUp({
                email: "test@example.com",
                password: "pass123",
            });
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            const data = result.data;
            expect(data.user.email).toBe("test@example.com");
            expect("session" in data && data.session).not.toBeNull();
            if ("session" in data && data.session) {
                expect(data.session.access_token).toBeTruthy();
                expect(data.session.user.email).toBe("test@example.com");
            }
        });
        it("returns needsConfirmation when email confirmation is required", async () => {
            const { auth } = makeAuth({ requireEmailConfirmation: true });
            const result = await auth.signUp({
                email: "confirm@example.com",
                password: "pass123",
            });
            expect(result.error).toBeNull();
            expect(result.data).not.toBeNull();
            const data = result.data;
            expect("needsConfirmation" in data && data.needsConfirmation).toBe(true);
            if ("session" in data) {
                expect(data.session).toBeNull();
            }
        });
        it("rejects duplicate email registration", async () => {
            const { auth } = makeAuth();
            await auth.signUp({ email: "dupe@example.com", password: "pass1" });
            const result = await auth.signUp({
                email: "dupe@example.com",
                password: "pass2",
            });
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toContain("already registered");
        });
        it("stores user metadata", async () => {
            const { auth } = makeAuth();
            const result = await auth.signUp({
                email: "meta@example.com",
                password: "pass123",
                userMetadata: { name: "Alice", age: 30 },
            });
            expect(result.error).toBeNull();
            const data = result.data;
            expect(data.user.userMetadata).toMatchObject({ name: "Alice", age: 30 });
        });
    });
    describe("signInWithPassword", () => {
        it("signs in with valid email and password", async () => {
            const { auth } = makeAuth();
            await auth.signUp({ email: "user@example.com", password: "secret" });
            const result = await auth.signInWithPassword({
                email: "user@example.com",
                password: "secret",
            });
            expect(result.error).toBeNull();
            expect(result.data?.session?.access_token).toBeTruthy();
        });
        it("rejects wrong password", async () => {
            const { auth } = makeAuth();
            await auth.signUp({ email: "user@example.com", password: "correct" });
            const result = await auth.signInWithPassword({
                email: "user@example.com",
                password: "wrong",
            });
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toContain("Invalid login credentials");
        });
        it("rejects unknown email", async () => {
            const { auth } = makeAuth();
            const result = await auth.signInWithPassword({
                email: "nobody@example.com",
                password: "pass",
            });
            expect(result.error).not.toBeNull();
        });
        it("rejects sign-in when email confirmation required and not confirmed", async () => {
            const { auth } = makeAuth({ requireEmailConfirmation: true });
            await auth.signUp({ email: "unconfirmed@example.com", password: "pass" });
            const result = await auth.signInWithPassword({
                email: "unconfirmed@example.com",
                password: "pass",
            });
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toContain("Email not confirmed");
        });
    });
    describe("getSession", () => {
        it("returns null session when not signed in", async () => {
            const { auth } = makeAuth();
            const result = await auth.getSession();
            expect(result.error).toBeNull();
            expect(result.data?.session).toBeNull();
        });
        it("returns session after sign in", async () => {
            const { auth } = makeAuth();
            await auth.signUp({ email: "sess@example.com", password: "pass" });
            await auth.signInWithPassword({ email: "sess@example.com", password: "pass" });
            const result = await auth.getSession();
            expect(result.error).toBeNull();
            expect(result.data?.session).not.toBeNull();
            expect(result.data?.session?.user.email).toBe("sess@example.com");
        });
    });
    describe("signOut", () => {
        it("clears session on sign out", async () => {
            const { auth } = makeAuth();
            await auth.signUp({ email: "logout@example.com", password: "pass" });
            const before = await auth.getSession();
            expect(before.data?.session).not.toBeNull();
            await auth.signOut();
            const after = await auth.getSession();
            expect(after.data?.session).toBeNull();
        });
    });
    describe("onAuthStateChange", () => {
        it("fires SIGNED_IN event when user signs in", async () => {
            const { auth } = makeAuth();
            const events = [];
            const { data } = auth.onAuthStateChange((event) => {
                events.push(event);
            });
            await auth.signUp({ email: "event@example.com", password: "pass" });
            expect(events).toContain("SIGNED_IN");
            data.subscription.unsubscribe();
        });
        it("fires SIGNED_OUT event when user signs out", async () => {
            const { auth } = makeAuth();
            const events = [];
            const { data } = auth.onAuthStateChange((event) => {
                events.push(event);
            });
            await auth.signUp({ email: "evout@example.com", password: "pass" });
            await auth.signOut();
            expect(events).toContain("SIGNED_OUT");
            data.subscription.unsubscribe();
        });
        it("stops receiving events after unsubscribe", async () => {
            const { auth } = makeAuth();
            const events = [];
            const { data } = auth.onAuthStateChange((event) => {
                events.push(event);
            });
            data.subscription.unsubscribe();
            await auth.signUp({ email: "unsub@example.com", password: "pass" });
            expect(events).toHaveLength(0);
        });
    });
    describe("verifyOtp", () => {
        it("completes OTP flow successfully", async () => {
            const { auth, otpStore } = makeAuth({ requireEmailConfirmation: true });
            await auth.signUp({ email: "otp@example.com", password: "pass" });
            const inbox = auth.getOtpInbox();
            expect(inbox.length).toBeGreaterThan(0);
            const otp = inbox[0];
            const result = await auth.verifyOtp({
                email: "otp@example.com",
                token: otp.token,
                type: "email",
            });
            expect(result.error).toBeNull();
            expect(result.data?.session).not.toBeNull();
            expect(result.data?.user.email).toBe("otp@example.com");
            void otpStore;
        });
        it("rejects expired OTP", async () => {
            const { auth, otpStore } = makeAuth({ requireEmailConfirmation: true });
            await auth.signUp({ email: "expired@example.com", password: "pass" });
            const inbox = auth.getOtpInbox();
            const otp = inbox[0];
            // Expire it manually
            const record = otpStore.get(otp.id);
            record.expiresAt = new Date(Date.now() - 1000).toISOString();
            otpStore.set(otp.id, record);
            const result = await auth.verifyOtp({
                email: "expired@example.com",
                token: otp.token,
                type: "email",
            });
            expect(result.error).not.toBeNull();
            expect(result.error?.message).toContain("expired");
        });
        it("rejects already used OTP", async () => {
            const { auth } = makeAuth({ requireEmailConfirmation: true });
            await auth.signUp({ email: "used@example.com", password: "pass" });
            const inbox = auth.getOtpInbox();
            const otp = inbox[0];
            await auth.verifyOtp({
                email: "used@example.com",
                token: otp.token,
                type: "email",
            });
            const second = await auth.verifyOtp({
                email: "used@example.com",
                token: otp.token,
                type: "email",
            });
            expect(second.error).not.toBeNull();
            expect(second.error?.message).toContain("already used");
        });
    });
    describe("exchangeCodeForSession", () => {
        it("accepts a stored auth code", async () => {
            const { auth } = makeAuth();
            const signUpResult = await auth.signUp({
                email: "code@example.com",
                password: "pass",
            });
            expect(signUpResult.error).toBeNull();
            const userId = signUpResult.data.user.id;
            auth.storeAuthCode("testcode123", userId, 60);
            const result = await auth.exchangeCodeForSession("testcode123");
            expect(result.error).toBeNull();
            expect(result.data?.session.user.email).toBe("code@example.com");
        });
        it("accepts user ID directly as dev convenience", async () => {
            const { auth } = makeAuth();
            const signUpResult = await auth.signUp({
                email: "devcode@example.com",
                password: "pass",
            });
            const userId = signUpResult.data.user.id;
            const result = await auth.exchangeCodeForSession(userId);
            expect(result.error).toBeNull();
            expect(result.data?.session.user.id).toBe(userId);
        });
        it("rejects invalid code", async () => {
            const { auth } = makeAuth();
            const result = await auth.exchangeCodeForSession("not-a-real-code");
            expect(result.error).not.toBeNull();
        });
    });
    describe("admin.createUser", () => {
        it("creates a user bypassing sign-up flow", () => {
            const { auth } = makeAuth();
            const result = auth.admin.createUser({
                email: "admin-created@example.com",
                password: "adminpass",
                emailConfirm: true,
            });
            expect(result.error).toBeNull();
            expect(result.data?.user.email).toBe("admin-created@example.com");
            expect(result.data?.user.emailConfirmedAt).not.toBeNull();
        });
        it("rejects duplicate email", () => {
            const { auth } = makeAuth();
            auth.admin.createUser({ email: "dup@example.com", password: "p" });
            const result = auth.admin.createUser({
                email: "dup@example.com",
                password: "p2",
            });
            expect(result.error).not.toBeNull();
        });
    });
    describe("admin.listUsers", () => {
        it("lists all active users", () => {
            const { auth } = makeAuth();
            auth.admin.createUser({ email: "a@example.com" });
            auth.admin.createUser({ email: "b@example.com" });
            auth.admin.createUser({ email: "c@example.com" });
            const result = auth.admin.listUsers();
            expect(result.error).toBeNull();
            expect(result.data?.total).toBe(3);
            expect(result.data?.users).toHaveLength(3);
        });
        it("paginates results", () => {
            const { auth } = makeAuth();
            for (let i = 0; i < 10; i++) {
                auth.admin.createUser({ email: `user${i}@example.com` });
            }
            const page1 = auth.admin.listUsers({ page: 1, perPage: 3 });
            const page2 = auth.admin.listUsers({ page: 2, perPage: 3 });
            expect(page1.data?.users).toHaveLength(3);
            expect(page2.data?.users).toHaveLength(3);
            expect(page1.data?.total).toBe(10);
        });
        it("excludes soft-deleted users", () => {
            const { auth } = makeAuth();
            const created = auth.admin.createUser({ email: "deleted@example.com" });
            auth.admin.deleteUser(created.data.user.id, { shouldSoftDelete: true });
            const result = auth.admin.listUsers();
            expect(result.data?.total).toBe(0);
        });
    });
    describe("admin.updateUserById", () => {
        it("updates user fields", () => {
            const { auth } = makeAuth();
            const { data } = auth.admin.createUser({ email: "update@example.com" });
            const id = data.user.id;
            const result = auth.admin.updateUserById(id, {
                email: "new@example.com",
                role: "service_role",
                userMetadata: { foo: "bar" },
            });
            expect(result.error).toBeNull();
            expect(result.data?.user.email).toBe("new@example.com");
            expect(result.data?.user.role).toBe("service_role");
            expect(result.data?.user.userMetadata).toMatchObject({ foo: "bar" });
        });
    });
    describe("admin.deleteUser", () => {
        it("hard deletes user", () => {
            const { auth } = makeAuth();
            const { data } = auth.admin.createUser({ email: "harddelete@example.com" });
            const id = data.user.id;
            auth.admin.deleteUser(id);
            const found = auth.admin.getUserById(id);
            expect(found.error).not.toBeNull();
        });
        it("soft deletes user", () => {
            const { auth } = makeAuth();
            const { data } = auth.admin.createUser({ email: "softdelete@example.com" });
            const id = data.user.id;
            auth.admin.deleteUser(id, { shouldSoftDelete: true });
            const found = auth.admin.getUserById(id);
            expect(found.error).toBeNull();
            expect(found.data?.user.deletedAt).not.toBeNull();
        });
    });
});
//# sourceMappingURL=local-auth.test.js.map