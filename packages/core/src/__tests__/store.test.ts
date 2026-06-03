import { describe, expect, it, beforeEach } from "vitest";
import { FakeStore } from "../store.js";
import { FakebaseError } from "../errors.js";
import type { TableIR } from "../schema/ir.js";

const userTable: TableIR = {
  schema: "public",
  name: "users",
  primaryKey: "id",
  rlsEnabled: false,
  columns: [
    { name: "id", type: "uuid", nullable: false, primaryKey: true },
    { name: "name", type: "text", nullable: false },
    { name: "email", type: "text", nullable: false, unique: true },
  ],
  indexes: [{ name: "users_email_idx", columns: ["email"], unique: true }],
  policies: [],
};

describe("FakeStore", () => {
  let store: FakeStore;

  beforeEach(() => {
    store = new FakeStore();
    store.registerTable(userTable);
  });

  describe("insert", () => {
    it("inserts a row and returns it", () => {
      const row = store.insert("public", "users", {
        id: "1",
        name: "Alice",
        email: "alice@example.com",
      });
      expect(row).toMatchObject({ id: "1", name: "Alice" });
    });

    it("throws on duplicate primary key", () => {
      store.insert("public", "users", {
        id: "1",
        name: "Alice",
        email: "alice@example.com",
      });
      expect(() =>
        store.insert("public", "users", {
          id: "1",
          name: "Alice2",
          email: "alice2@example.com",
        }),
      ).toThrowError(FakebaseError);
    });

    it("throws for unknown table", () => {
      expect(() => store.insert("public", "nonexistent", { id: "1" })).toThrowError(
        FakebaseError,
      );
    });
  });

  describe("getByPk", () => {
    it("returns the row by primary key", () => {
      store.insert("public", "users", { id: "1", name: "Alice", email: "a@b.com" });
      const row = store.getByPk("public", "users", "1");
      expect(row?.["name"]).toBe("Alice");
    });

    it("returns undefined for missing pk", () => {
      expect(store.getByPk("public", "users", "999")).toBeUndefined();
    });
  });

  describe("list", () => {
    it("returns all rows in insertion order", () => {
      store.insert("public", "users", { id: "1", name: "A", email: "a@x.com" });
      store.insert("public", "users", { id: "2", name: "B", email: "b@x.com" });
      store.insert("public", "users", { id: "3", name: "C", email: "c@x.com" });
      const rows = store.list("public", "users");
      expect(rows.map((r) => r["id"])).toEqual(["1", "2", "3"]);
    });

    it("returns empty array for empty table", () => {
      expect(store.list("public", "users")).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("applies a partial patch", () => {
      store.insert("public", "users", { id: "1", name: "Alice", email: "a@x.com" });
      const updated = store.update("public", "users", "1", { name: "Alicia" });
      expect(updated["name"]).toBe("Alicia");
      expect(updated["email"]).toBe("a@x.com");
    });

    it("throws for non-existent row", () => {
      expect(() => store.update("public", "users", "999", { name: "X" })).toThrowError(
        FakebaseError,
      );
    });
  });

  describe("delete", () => {
    it("deletes and returns the row", () => {
      store.insert("public", "users", { id: "1", name: "Alice", email: "a@x.com" });
      const deleted = store.delete("public", "users", "1");
      expect(deleted?.["id"]).toBe("1");
      expect(store.getByPk("public", "users", "1")).toBeUndefined();
    });

    it("returns undefined for non-existent pk", () => {
      const result = store.delete("public", "users", "999");
      expect(result).toBeUndefined();
    });
  });

  describe("truncate", () => {
    it("removes all rows", () => {
      store.insert("public", "users", { id: "1", name: "A", email: "a@x.com" });
      store.insert("public", "users", { id: "2", name: "B", email: "b@x.com" });
      store.truncate("public", "users");
      expect(store.list("public", "users")).toHaveLength(0);
    });
  });
});
