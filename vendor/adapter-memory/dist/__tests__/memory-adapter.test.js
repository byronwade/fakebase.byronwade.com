import { describe, expect, it, beforeEach } from "vitest";
import { MemoryAdapter } from "../memory-adapter.js";
const schema = {
    version: 1,
    enums: [],
    functions: [],
    tables: [
        {
            schema: "public",
            name: "todos",
            primaryKey: "id",
            rlsEnabled: false,
            columns: [
                { name: "id", type: "uuid", nullable: false, primaryKey: true },
                { name: "title", type: "text", nullable: false },
                { name: "done", type: "bool", nullable: false },
                { name: "priority", type: "int4", nullable: true },
            ],
            indexes: [],
            policies: [],
        },
    ],
};
describe("MemoryAdapter", () => {
    let adapter;
    beforeEach(async () => {
        adapter = new MemoryAdapter();
        await adapter.initialize(schema);
    });
    describe("insert", () => {
        it("inserts a row and returns it", async () => {
            const [row] = await adapter.insert("todos", "public", [
                { title: "Buy milk", done: false },
            ]);
            expect(row).toBeDefined();
            expect(row?.["title"]).toBe("Buy milk");
            expect(typeof row?.["id"]).toBe("string");
        });
        it("inserts multiple rows", async () => {
            const rows = await adapter.insert("todos", "public", [
                { title: "A", done: false },
                { title: "B", done: true },
            ]);
            expect(rows).toHaveLength(2);
        });
        it("preserves explicit id", async () => {
            const [row] = await adapter.insert("todos", "public", [
                { id: "fixed-id", title: "Test", done: false },
            ]);
            expect(row?.["id"]).toBe("fixed-id");
        });
    });
    describe("select", () => {
        beforeEach(async () => {
            await adapter.insert("todos", "public", [
                { id: "1", title: "Alpha", done: false, priority: 3 },
                { id: "2", title: "Beta", done: true, priority: 1 },
                { id: "3", title: "Gamma", done: false, priority: 2 },
            ]);
        });
        it("returns all rows", async () => {
            const result = await adapter.select("todos", "public", {
                table: "todos",
                schema: "public",
                filters: [],
            });
            expect(result.data).toHaveLength(3);
        });
        it("filters rows", async () => {
            const result = await adapter.select("todos", "public", {
                table: "todos",
                schema: "public",
                filters: [{ column: "done", operator: "eq", value: true }],
            });
            expect(result.data).toHaveLength(1);
            expect(result.data?.[0]?.["title"]).toBe("Beta");
        });
        it("orders rows", async () => {
            const result = await adapter.select("todos", "public", {
                table: "todos",
                schema: "public",
                filters: [],
                orderBy: [{ column: "priority", ascending: true }],
            });
            expect(result.data?.map((r) => r["title"])).toEqual(["Beta", "Gamma", "Alpha"]);
        });
        it("applies limit + offset", async () => {
            const result = await adapter.select("todos", "public", {
                table: "todos",
                schema: "public",
                filters: [],
                orderBy: [{ column: "id", ascending: true }],
                limit: 2,
                offset: 1,
            });
            expect(result.data?.map((r) => r["id"])).toEqual(["2", "3"]);
        });
    });
    describe("update", () => {
        beforeEach(async () => {
            await adapter.insert("todos", "public", [
                { id: "1", title: "Alpha", done: false },
                { id: "2", title: "Beta", done: false },
            ]);
        });
        it("updates matching rows", async () => {
            const updated = await adapter.update("todos", "public", { done: true }, [
                { column: "id", operator: "eq", value: "1" },
            ]);
            expect(updated).toHaveLength(1);
            expect(updated[0]?.["done"]).toBe(true);
            expect(updated[0]?.["title"]).toBe("Alpha");
        });
        it("updates all rows when no filter", async () => {
            const updated = await adapter.update("todos", "public", { done: true }, []);
            expect(updated).toHaveLength(2);
        });
    });
    describe("upsert", () => {
        it("inserts a new row when no conflict", async () => {
            const rows = await adapter.upsert("todos", "public", [
                { id: "new-1", title: "New task", done: false },
            ]);
            expect(rows[0]?.["id"]).toBe("new-1");
        });
        it("updates an existing row on conflict", async () => {
            await adapter.insert("todos", "public", [{ id: "x", title: "Old", done: false }]);
            const rows = await adapter.upsert("todos", "public", [
                { id: "x", title: "Updated", done: true },
            ]);
            expect(rows[0]?.["title"]).toBe("Updated");
            expect(rows[0]?.["done"]).toBe(true);
        });
    });
    describe("delete", () => {
        beforeEach(async () => {
            await adapter.insert("todos", "public", [
                { id: "1", title: "Alpha", done: false },
                { id: "2", title: "Beta", done: true },
                { id: "3", title: "Gamma", done: false },
            ]);
        });
        it("deletes matching rows", async () => {
            const deleted = await adapter.delete("todos", "public", [
                { column: "done", operator: "eq", value: false },
            ]);
            expect(deleted).toHaveLength(2);
            const remaining = await adapter.select("todos", "public", {
                table: "todos",
                schema: "public",
                filters: [],
            });
            expect(remaining.data).toHaveLength(1);
        });
        it("deletes all rows when no filter", async () => {
            await adapter.delete("todos", "public", []);
            const result = await adapter.select("todos", "public", {
                table: "todos",
                schema: "public",
                filters: [],
            });
            expect(result.data).toHaveLength(0);
        });
    });
    describe("rpc", () => {
        it("throws CapabilityError for unregistered function", async () => {
            await expect(adapter.rpc("unknown_fn", {})).rejects.toThrow();
        });
        it("invokes a registered handler", async () => {
            adapter.registerRpc("ping", () => "pong");
            const result = await adapter.rpc("ping", {});
            expect(result).toBe("pong");
        });
    });
    describe("close", () => {
        it("completes without error", async () => {
            await expect(adapter.close()).resolves.toBeUndefined();
        });
    });
});
//# sourceMappingURL=memory-adapter.test.js.map