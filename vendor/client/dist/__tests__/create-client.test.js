/**
 * Integration tests for `createClient` using the MemoryAdapter.
 *
 * Verifies the end-to-end flow: client creation → query builder → kernel
 * execution → response shape, as well as auth and storage facades.
 */
import { describe, it, expect } from "vitest";
import { createMemoryKernel } from "@fakebase/adapter-memory";
import { createClient } from "../create-client.js";
// ---------------------------------------------------------------------------
// Test schema IR
// ---------------------------------------------------------------------------
const ir = {
    version: 1,
    enums: [],
    functions: [],
    tables: [
        {
            schema: "public",
            name: "products",
            primaryKey: "id",
            rlsEnabled: false,
            policies: [],
            indexes: [],
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    nullable: false,
                    primaryKey: true,
                    defaultSql: "gen_random_uuid()",
                },
                { name: "name", type: "text", nullable: false },
                { name: "price", type: "float4", nullable: false },
                { name: "in_stock", type: "bool", nullable: false, defaultSql: "true" },
            ],
        },
        {
            schema: "public",
            name: "orders",
            primaryKey: "id",
            rlsEnabled: false,
            policies: [],
            indexes: [],
            columns: [
                {
                    name: "id",
                    type: "uuid",
                    nullable: false,
                    primaryKey: true,
                    defaultSql: "gen_random_uuid()",
                },
                { name: "product_id", type: "uuid", nullable: false },
                { name: "quantity", type: "int4", nullable: false },
                { name: "total", type: "float4", nullable: false },
            ],
        },
    ],
};
// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
function makeClient() {
    const kernel = createMemoryKernel(ir);
    const client = createClient("http://localhost", "anon-key", {
        kernel,
    });
    return { client, kernel };
}
// ---------------------------------------------------------------------------
// Basic client creation
// ---------------------------------------------------------------------------
describe("createClient", () => {
    it("creates a client without throwing", () => {
        expect(() => makeClient()).not.toThrow();
    });
    it("ignores the url and key parameters", () => {
        const kernel = createMemoryKernel(ir);
        expect(() => createClient("irrelevant-url", "irrelevant-key", { kernel })).not.toThrow();
    });
});
// ---------------------------------------------------------------------------
// from() — query builder integration
// ---------------------------------------------------------------------------
describe("client.from()", () => {
    it("returns an empty result for an empty table", async () => {
        const { client } = makeClient();
        const { data, error } = await client.from("products").select("*");
        expect(error).toBeNull();
        expect(data).toEqual([]);
    });
    it("inserts and reads back rows", async () => {
        const { client } = makeClient();
        await client.from("products").insert({ name: "Widget", price: 9.99 });
        const { data, error } = await client.from("products").select("*");
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data[0].name).toBe("Widget");
    });
    it("filters with .eq()", async () => {
        const { client } = makeClient();
        await client.from("products").insert([
            { name: "Widget", price: 9.99 },
            { name: "Gadget", price: 19.99 },
        ]);
        const { data } = await client.from("products").select("*").eq("name", "Widget");
        expect(data).toHaveLength(1);
        expect(data[0].name).toBe("Widget");
    });
    it("chains order, limit, and range", async () => {
        const { client } = makeClient();
        await client.from("products").insert([
            { name: "A", price: 30 },
            { name: "B", price: 10 },
            { name: "C", price: 20 },
        ]);
        const { data } = await client
            .from("products")
            .select("name")
            .order("price")
            .limit(2);
        expect(data).toHaveLength(2);
        expect(data[0].name).toBe("B");
        expect(data[1].name).toBe("C");
    });
    it(".single() returns a single row object (not array)", async () => {
        const { client } = makeClient();
        await client.from("products").insert({ name: "Solo", price: 1 });
        const { data, error } = await client.from("products").select("*").single();
        expect(error).toBeNull();
        expect(data).not.toBeNull();
        expect(data.name).toBe("Solo");
    });
    it(".single() errors with PGRST116 on 0 rows", async () => {
        const { client } = makeClient();
        const { error } = await client.from("products").select().single();
        expect(error?.code).toBe("PGRST116");
    });
    it("update returns null data without .select()", async () => {
        const { client } = makeClient();
        await client.from("products").insert({ name: "Widget", price: 9.99 });
        const { data, error } = await client
            .from("products")
            .update({ price: 14.99 })
            .eq("name", "Widget");
        expect(error).toBeNull();
        expect(data).toBeNull();
    });
    it("update with .select() returns updated rows", async () => {
        const { client } = makeClient();
        await client.from("products").insert({ name: "Widget", price: 9.99 });
        const { data, error } = await client
            .from("products")
            .update({ price: 14.99 })
            .eq("name", "Widget")
            .select("price");
        expect(error).toBeNull();
        expect(data[0].price).toBe(14.99);
    });
    it("delete without .select() returns null", async () => {
        const { client } = makeClient();
        await client.from("products").insert({ name: "Temp", price: 1 });
        const { data, error } = await client.from("products").delete().eq("name", "Temp");
        expect(error).toBeNull();
        expect(data).toBeNull();
    });
    it("delete with .select() returns deleted rows", async () => {
        const { client } = makeClient();
        await client.from("products").insert({ name: "Temp", price: 1 });
        const { data } = await client
            .from("products")
            .delete()
            .eq("name", "Temp")
            .select("name");
        expect(data[0].name).toBe("Temp");
    });
});
// ---------------------------------------------------------------------------
// schema() — alternate schema
// ---------------------------------------------------------------------------
describe("client.schema()", () => {
    it("queries tables in a named schema", async () => {
        const { client } = makeClient();
        // The memory kernel uses schema.table keys; "public" is the default.
        // Using schema() just changes the prefix sent to the kernel.
        const { data, error } = await client.schema("public").from("products").select();
        expect(error).toBeNull();
        expect(data).toEqual([]);
    });
});
// ---------------------------------------------------------------------------
// Auth facade
// ---------------------------------------------------------------------------
describe("client.auth", () => {
    it("signUp creates a user and session", async () => {
        const { client } = makeClient();
        const { data, error } = await client.auth.signUp({
            email: "alice@example.com",
            password: "secure-password",
        });
        expect(error).toBeNull();
        expect(data.user).not.toBeNull();
        expect(data.session).not.toBeNull();
        expect(data.user?.email).toBe("alice@example.com");
    });
    it("signInWithPassword succeeds with correct credentials", async () => {
        const { client } = makeClient();
        await client.auth.signUp({ email: "bob@example.com", password: "pw123" });
        const { data, error } = await client.auth.signInWithPassword({
            email: "bob@example.com",
            password: "pw123",
        });
        expect(error).toBeNull();
        expect(data.user?.email).toBe("bob@example.com");
    });
    it("signInWithPassword fails with wrong password", async () => {
        const { client } = makeClient();
        await client.auth.signUp({ email: "carol@example.com", password: "right" });
        const { data, error } = await client.auth.signInWithPassword({
            email: "carol@example.com",
            password: "wrong",
        });
        expect(error).not.toBeNull();
        expect(data.user).toBeNull();
    });
    it("getSession returns null before signing in", async () => {
        const { client } = makeClient();
        const { data } = await client.auth.getSession();
        expect(data.session).toBeNull();
    });
    it("getSession returns session after signing in", async () => {
        const { client } = makeClient();
        await client.auth.signUp({ email: "dave@example.com", password: "pw" });
        const { data } = await client.auth.getSession();
        expect(data.session).not.toBeNull();
    });
    it("signOut clears the session", async () => {
        const { client } = makeClient();
        await client.auth.signUp({ email: "eve@example.com", password: "pw" });
        await client.auth.signOut();
        const { data } = await client.auth.getSession();
        expect(data.session).toBeNull();
    });
    it("admin.listUsers returns all registered users", async () => {
        const { client } = makeClient();
        await client.auth.signUp({ email: "u1@example.com", password: "pw" });
        await client.auth.signUp({ email: "u2@example.com", password: "pw" });
        const { data } = await client.auth.admin.listUsers();
        expect(data?.users).toHaveLength(2);
    });
    it("onAuthStateChange fires INITIAL_SESSION callback", async () => {
        const { client } = makeClient();
        await client.auth.signUp({ email: "f@example.com", password: "pw" });
        let received = false;
        const { data: { subscription }, } = client.auth.onAuthStateChange((event, _session) => {
            if (event === "INITIAL_SESSION")
                received = true;
        });
        // Callback is deferred via queueMicrotask
        await Promise.resolve();
        expect(received).toBe(true);
        subscription.unsubscribe();
    });
});
// ---------------------------------------------------------------------------
// Storage facade
// ---------------------------------------------------------------------------
describe("client.storage", () => {
    it("creates and lists buckets", async () => {
        const { client } = makeClient();
        await client.storage.createBucket("avatars", { public: true });
        const { data } = await client.storage.listBuckets();
        expect(data).toHaveLength(1);
        expect(data[0].id).toBe("avatars");
    });
    it("uploads and downloads files", async () => {
        const { client } = makeClient();
        await client.storage.createBucket("docs");
        await client.storage.from("docs").upload("hello.txt", "Hello, World!");
        const { data, error } = await client.storage.from("docs").download("hello.txt");
        expect(error).toBeNull();
        expect(data).toBeInstanceOf(Blob);
    });
    it("getPublicUrl returns a URL string", () => {
        const { client } = makeClient();
        const { data } = client.storage.from("avatars").getPublicUrl("profile.png");
        expect(typeof data.publicUrl).toBe("string");
        expect(data.publicUrl).toContain("profile.png");
    });
});
// ---------------------------------------------------------------------------
// Realtime facade
// ---------------------------------------------------------------------------
describe("client.channel()", () => {
    it("creates a channel and subscribes without throwing", () => {
        const { client } = makeClient();
        const ch = client.channel("my-channel");
        expect(() => ch.subscribe()).not.toThrow();
    });
    it("receives INSERT events via postgres_changes", async () => {
        const { client } = makeClient();
        const received = [];
        const ch = client.channel("test");
        ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "products" }, (payload) => received.push(payload)).subscribe();
        await client.from("products").insert({ name: "Live Widget", price: 5 });
        expect(received).toHaveLength(1);
    });
    it("removeChannel unsubscribes the channel", async () => {
        const { client } = makeClient();
        const ch = client.channel("to-remove").subscribe();
        const result = await client.removeChannel(ch);
        expect(result).toBe("ok");
        expect(client.getChannels()).toHaveLength(0);
    });
});
// ---------------------------------------------------------------------------
// Functions facade
// ---------------------------------------------------------------------------
describe("client.functions.invoke()", () => {
    it("returns error for unregistered functions", async () => {
        const { client } = makeClient();
        const { data, error } = await client.functions.invoke("unknown-fn");
        expect(data).toBeNull();
        expect(error).not.toBeNull();
    });
    it("calls registered handler and returns result", async () => {
        const { client, kernel } = makeClient();
        kernel.functions.register("hello", async () => ({ message: "Hello!" }));
        const { data, error } = await client.functions.invoke("hello");
        expect(error).toBeNull();
        expect(data?.["message"]).toBe("Hello!");
    });
});
//# sourceMappingURL=create-client.test.js.map