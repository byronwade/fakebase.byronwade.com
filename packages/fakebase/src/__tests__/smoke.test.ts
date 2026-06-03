/**
 * Smoke test for the headline `fakebase` package.
 *
 * Exercises the public entry point end-to-end: build a memory kernel, create a
 * Supabase-shaped client, and round-trip data, auth, and the SSR helpers.
 */

import { describe, it, expect } from "vitest";
import { createClient, createMemoryKernel } from "../index.js";
import { createServerClient } from "../next.js";
import type { ProjectSchemaIR } from "@byronwade/core";

const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "todos",
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
        { name: "title", type: "text", nullable: false },
        { name: "done", type: "bool", nullable: false, defaultSql: "false" },
      ],
    },
  ],
};

describe("fakebase entry point", () => {
  it("creates a client from the top-level package", () => {
    const kernel = createMemoryKernel(schema);
    expect(() => createClient("http://localhost", "anon", { kernel })).not.toThrow();
  });

  it("round-trips an insert and select", async () => {
    const kernel = createMemoryKernel(schema);
    const db = createClient("http://localhost", "anon", { kernel });

    const insert = await db.from("todos").insert({ title: "ship it" }).select();
    expect(insert.error).toBeNull();
    expect(insert.data).toHaveLength(1);

    const { data, error } = await db.from("todos").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect((data as Array<{ title: string }>)[0]!.title).toBe("ship it");
  });

  it("supports auth sign-up and sign-in via the facade", async () => {
    const kernel = createMemoryKernel(schema);
    const db = createClient("http://localhost", "anon", { kernel });

    const signUp = await db.auth.signUp({
      email: "dev@example.com",
      password: "password123",
    });
    expect(signUp.error).toBeNull();

    const signIn = await db.auth.signInWithPassword({
      email: "dev@example.com",
      password: "password123",
    });
    expect(signIn.error).toBeNull();
    expect(signIn.data.user?.email).toBe("dev@example.com");
  });

  it("exposes a Next.js server client helper", () => {
    const kernel = createMemoryKernel(schema);
    const store = new Map<string, string>();
    const client = createServerClient("http://localhost", "anon", {
      kernel,
      cookies: {
        get: (name) => store.get(name),
        set: (name, value) => void store.set(name, value),
        remove: (name) => void store.delete(name),
      },
    });
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth.getSession).toBe("function");
  });
});
