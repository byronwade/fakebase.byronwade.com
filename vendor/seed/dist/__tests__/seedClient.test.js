import { describe, expect, it } from "vitest";
import { createMemoryKernel } from "@fakebase/adapter-memory";
import { createClient } from "@fakebase/client";
import { seedClient } from "../seedClient.js";
const SCHEMA = {
    version: 1,
    enums: [],
    functions: [],
    tables: [
        {
            schema: "public",
            name: "users",
            primaryKey: "id",
            rlsEnabled: false,
            indexes: [],
            policies: [],
            columns: [
                { name: "id", type: "uuid", nullable: false, primaryKey: true },
                { name: "email", type: "text", nullable: false },
            ],
        },
        {
            schema: "public",
            name: "posts",
            primaryKey: "id",
            rlsEnabled: false,
            indexes: [],
            policies: [],
            columns: [
                { name: "id", type: "uuid", nullable: false, primaryKey: true },
                {
                    name: "author_id",
                    type: "uuid",
                    nullable: false,
                    references: { table: "users", column: "id" },
                },
                { name: "title", type: "text", nullable: false },
            ],
        },
    ],
};
function newClient() {
    const kernel = createMemoryKernel(SCHEMA);
    return createClient("http://localhost", "service_role", { kernel });
}
describe("seedClient", () => {
    it("inserts the requested number of rows into every table", async () => {
        const client = newClient();
        await seedClient(client, SCHEMA, { rowsPerTable: 5, seed: 1 });
        const users = await client.from("users").select("*");
        const posts = await client.from("posts").select("*");
        expect(users.data).toHaveLength(5);
        expect(posts.data).toHaveLength(5);
    });
    it("inserts FK values that reference real parent rows", async () => {
        const client = newClient();
        await seedClient(client, SCHEMA, { rowsPerTable: 8, seed: 2 });
        const users = await client.from("users").select("*");
        const posts = await client.from("posts").select("*");
        const ids = new Set((users.data ?? []).map((u) => u.id));
        for (const p of posts.data ?? []) {
            expect(ids.has(p.author_id)).toBe(true);
        }
    });
    it("is idempotent: a second run skips already-populated tables", async () => {
        const client = newClient();
        await seedClient(client, SCHEMA, { rowsPerTable: 4, seed: 3 });
        const result = await seedClient(client, SCHEMA, { rowsPerTable: 4, seed: 3 });
        const users = await client.from("users").select("*");
        expect(users.data).toHaveLength(4); // not 8
        expect(result.skipped).toContain("users");
        expect(result.skipped).toContain("posts");
    });
    it("reports how many rows were inserted per table", async () => {
        const client = newClient();
        const result = await seedClient(client, SCHEMA, { rowsPerTable: 6, seed: 4 });
        expect(result.inserted.users).toBe(6);
        expect(result.inserted.posts).toBe(6);
    });
});
//# sourceMappingURL=seedClient.test.js.map