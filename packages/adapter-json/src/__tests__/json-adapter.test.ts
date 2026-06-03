import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm, readFile } from "node:fs/promises";
import { JsonAdapter } from "../json-adapter.js";
import type { ProjectSchemaIR } from "@byronwade/core";

const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "notes",
      primaryKey: "id",
      rlsEnabled: false,
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true },
        { name: "content", type: "text", nullable: false },
        { name: "pinned", type: "bool", nullable: false },
      ],
      indexes: [],
      policies: [],
    },
  ],
};

function tmpDir(): string {
  return join(
    tmpdir(),
    `fakebase-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
}

describe("JsonAdapter", () => {
  let dir: string;
  let adapter: JsonAdapter;

  beforeEach(async () => {
    dir = tmpDir();
    adapter = new JsonAdapter({ dir });
    await adapter.initialize(schema);
  });

  afterEach(async () => {
    await adapter.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe("insert", () => {
    it("inserts a row and returns it", async () => {
      const [row] = await adapter.insert("notes", "public", [
        { content: "Hello", pinned: false },
      ]);
      expect(row?.["content"]).toBe("Hello");
      expect(typeof row?.["id"]).toBe("string");
    });

    it("persists to disk after insert", async () => {
      await adapter.insert("notes", "public", [
        { id: "n1", content: "Saved", pinned: true },
      ]);
      const raw = await readFile(join(dir, "public.notes.json"), "utf8");
      const snapshot = JSON.parse(raw) as { rows: unknown[] };
      expect(snapshot.rows).toHaveLength(1);
    });
  });

  describe("select", () => {
    beforeEach(async () => {
      await adapter.insert("notes", "public", [
        { id: "1", content: "Alpha", pinned: false },
        { id: "2", content: "Beta", pinned: true },
        { id: "3", content: "Gamma", pinned: false },
      ]);
    });

    it("returns all rows", async () => {
      const result = await adapter.select("notes", "public", {
        table: "notes",
        schema: "public",
        filters: [],
      });
      expect(result.data).toHaveLength(3);
    });

    it("filters by eq", async () => {
      const result = await adapter.select("notes", "public", {
        table: "notes",
        schema: "public",
        filters: [{ column: "pinned", operator: "eq", value: true }],
      });
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.["content"]).toBe("Beta");
    });
  });

  describe("update", () => {
    beforeEach(async () => {
      await adapter.insert("notes", "public", [
        { id: "1", content: "Old", pinned: false },
      ]);
    });

    it("updates matching rows and flushes", async () => {
      await adapter.update("notes", "public", { content: "New", pinned: true }, [
        { column: "id", operator: "eq", value: "1" },
      ]);
      const raw = await readFile(join(dir, "public.notes.json"), "utf8");
      const snapshot = JSON.parse(raw) as { rows: Array<Record<string, unknown>> };
      expect(snapshot.rows[0]?.["content"]).toBe("New");
    });
  });

  describe("upsert", () => {
    it("inserts when no conflict", async () => {
      await adapter.upsert("notes", "public", [
        { id: "upsert-1", content: "New note", pinned: false },
      ]);
      const result = await adapter.select("notes", "public", {
        table: "notes",
        schema: "public",
        filters: [],
      });
      expect(result.data).toHaveLength(1);
    });

    it("updates on conflict", async () => {
      await adapter.insert("notes", "public", [
        { id: "u1", content: "Old", pinned: false },
      ]);
      await adapter.upsert("notes", "public", [
        { id: "u1", content: "Updated", pinned: true },
      ]);
      const result = await adapter.select("notes", "public", {
        table: "notes",
        schema: "public",
        filters: [{ column: "id", operator: "eq", value: "u1" }],
      });
      expect(result.data?.[0]?.["content"]).toBe("Updated");
    });
  });

  describe("delete", () => {
    beforeEach(async () => {
      await adapter.insert("notes", "public", [
        { id: "1", content: "A", pinned: false },
        { id: "2", content: "B", pinned: true },
      ]);
    });

    it("deletes matching rows", async () => {
      await adapter.delete("notes", "public", [
        { column: "pinned", operator: "eq", value: false },
      ]);
      const result = await adapter.select("notes", "public", {
        table: "notes",
        schema: "public",
        filters: [],
      });
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.["id"]).toBe("2");
    });

    it("flushes after delete", async () => {
      await adapter.delete("notes", "public", [
        { column: "id", operator: "eq", value: "1" },
      ]);
      const raw = await readFile(join(dir, "public.notes.json"), "utf8");
      const snapshot = JSON.parse(raw) as { rows: unknown[] };
      expect(snapshot.rows).toHaveLength(1);
    });
  });

  describe("persistence (hydration)", () => {
    it("reloads rows from disk on next initialize", async () => {
      await adapter.insert("notes", "public", [
        { id: "persist-1", content: "Remember me", pinned: false },
      ]);
      await adapter.close();

      const adapter2 = new JsonAdapter({ dir });
      await adapter2.initialize(schema);
      const result = await adapter2.select("notes", "public", {
        table: "notes",
        schema: "public",
        filters: [],
      });
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]?.["content"]).toBe("Remember me");
      await adapter2.close();
    });
  });

  describe("rpc", () => {
    it("throws for unregistered function", async () => {
      await expect(adapter.rpc("unknown", {})).rejects.toThrow();
    });

    it("calls a registered handler", async () => {
      adapter.registerRpc("echo", (args) => args["msg"]);
      const result = await adapter.rpc("echo", { msg: "hi" });
      expect(result).toBe("hi");
    });
  });
});
