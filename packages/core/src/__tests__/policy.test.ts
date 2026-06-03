import { describe, expect, it, beforeEach } from "vitest";
import { PolicyEngine } from "../policy/engine.js";
import { SchemaRegistry } from "../schema/registry.js";
import type { ProjectSchemaIR, TableIR } from "../schema/ir.js";
import type { RoleContext } from "../policy/engine.js";

function makeTable(overrides: Partial<TableIR> = {}): TableIR {
  return {
    schema: "public",
    name: "posts",
    columns: [
      { name: "id", type: "uuid", nullable: false, primaryKey: true },
      { name: "user_id", type: "uuid", nullable: false },
      { name: "body", type: "text", nullable: true },
    ],
    indexes: [],
    policies: [],
    rlsEnabled: false,
    primaryKey: "id",
    ...overrides,
  };
}

function makeSchema(table: TableIR): ProjectSchemaIR {
  return { tables: [table], enums: [], functions: [], version: 1 };
}

describe("PolicyEngine – RLS disabled", () => {
  it("allows all reads when RLS is off", () => {
    const table = makeTable({ rlsEnabled: false });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    const ctx: RoleContext = { role: "anon" };
    expect(engine.evaluateRead("posts", "public", { id: "1" }, ctx)).toBe(true);
  });

  it("allows all writes when RLS is off", () => {
    const table = makeTable({ rlsEnabled: false });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    const ctx: RoleContext = { role: "anon" };
    expect(engine.evaluateWrite("posts", "public", { id: "1" }, ctx, "INSERT")).toBe(
      true,
    );
  });
});

describe("PolicyEngine – service_role bypass", () => {
  it("service_role bypasses RLS reads", () => {
    const table = makeTable({ rlsEnabled: true });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    const ctx: RoleContext = { role: "service_role" };
    expect(engine.evaluateRead("posts", "public", { id: "1" }, ctx)).toBe(true);
  });

  it("service_role bypasses RLS writes", () => {
    const table = makeTable({ rlsEnabled: true });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    const ctx: RoleContext = { role: "service_role" };
    expect(engine.evaluateWrite("posts", "public", { id: "1" }, ctx, "DELETE")).toBe(
      true,
    );
  });
});

describe("PolicyEngine – default deny", () => {
  it("denies reads when RLS enabled but no policies", () => {
    const table = makeTable({ rlsEnabled: true, policies: [] });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    const ctx: RoleContext = { role: "authenticated", userId: "user-1" };
    expect(engine.evaluateRead("posts", "public", { id: "1" }, ctx)).toBe(false);
  });

  it("denies writes when RLS enabled but no policies", () => {
    const table = makeTable({ rlsEnabled: true, policies: [] });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    const ctx: RoleContext = { role: "authenticated", userId: "user-1" };
    expect(engine.evaluateWrite("posts", "public", { id: "1" }, ctx, "INSERT")).toBe(
      false,
    );
  });
});

describe("PolicyEngine – auth.uid() policy", () => {
  const table = makeTable({
    rlsEnabled: true,
    policies: [
      {
        name: "owner_select",
        table: "posts",
        schema: "public",
        command: "SELECT",
        roles: ["authenticated"],
        using: "auth.uid() = user_id",
        permissive: true,
      },
      {
        name: "owner_insert",
        table: "posts",
        schema: "public",
        command: "INSERT",
        roles: ["authenticated"],
        withCheck: "auth.uid() = user_id",
        permissive: true,
      },
    ],
  });

  let engine: PolicyEngine;
  beforeEach(() => {
    const registry = new SchemaRegistry(makeSchema(table));
    engine = new PolicyEngine(registry);
  });

  it("allows read for own row", () => {
    const ctx: RoleContext = { role: "authenticated", userId: "user-1" };
    expect(engine.evaluateRead("posts", "public", { user_id: "user-1" }, ctx)).toBe(
      true,
    );
  });

  it("denies read for other's row", () => {
    const ctx: RoleContext = { role: "authenticated", userId: "user-2" };
    expect(engine.evaluateRead("posts", "public", { user_id: "user-1" }, ctx)).toBe(
      false,
    );
  });

  it("allows insert for own row", () => {
    const ctx: RoleContext = { role: "authenticated", userId: "user-1" };
    expect(
      engine.evaluateWrite("posts", "public", { user_id: "user-1" }, ctx, "INSERT"),
    ).toBe(true);
  });

  it("denies insert for other's row", () => {
    const ctx: RoleContext = { role: "authenticated", userId: "user-2" };
    expect(
      engine.evaluateWrite("posts", "public", { user_id: "user-1" }, ctx, "INSERT"),
    ).toBe(false);
  });

  it("denies anon role (not in policy roles list)", () => {
    const ctx: RoleContext = { role: "anon" };
    expect(engine.evaluateRead("posts", "public", { user_id: "user-1" }, ctx)).toBe(
      false,
    );
  });
});

describe("PolicyEngine – isRlsEnabled", () => {
  it("returns true when enabled", () => {
    const table = makeTable({ rlsEnabled: true });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    expect(engine.isRlsEnabled("posts", "public")).toBe(true);
  });

  it("returns false when disabled", () => {
    const table = makeTable({ rlsEnabled: false });
    const registry = new SchemaRegistry(makeSchema(table));
    const engine = new PolicyEngine(registry);
    expect(engine.isRlsEnabled("posts", "public")).toBe(false);
  });
});
