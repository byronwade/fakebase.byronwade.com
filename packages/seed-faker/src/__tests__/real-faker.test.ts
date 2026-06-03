import { describe, expect, it } from "vitest";
import { faker } from "@faker-js/faker";
import type { ProjectSchemaIR } from "@fakebase/core";
import { generateRows } from "@fakebase/seed";
import { createFakerProvider, loadFakerProvider } from "../index.js";

// A schema that exercises every semantic mapping and every type branch, so a
// wrong method name on the real faker API throws here instead of in production.
const SCHEMA: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "kitchen_sink",
      primaryKey: "id",
      rlsEnabled: false,
      indexes: [],
      policies: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true },
        { name: "email", type: "text", nullable: false },
        { name: "first_name", type: "text", nullable: false },
        { name: "last_name", type: "text", nullable: false },
        { name: "username", type: "text", nullable: false },
        { name: "full_name", type: "text", nullable: false },
        { name: "avatar_url", type: "text", nullable: false },
        { name: "website", type: "text", nullable: false },
        { name: "slug", type: "text", nullable: false },
        { name: "title", type: "text", nullable: false },
        { name: "bio", type: "text", nullable: false },
        { name: "phone", type: "text", nullable: false },
        { name: "city", type: "text", nullable: false },
        { name: "country", type: "text", nullable: false },
        { name: "order_total", type: "numeric", nullable: false },
        { name: "age", type: "int4", nullable: false },
        { name: "view_count", type: "int4", nullable: false },
        { name: "published", type: "bool", nullable: false },
        { name: "ratio", type: "float8", nullable: false },
        { name: "big", type: "int8", nullable: false },
        { name: "created_at", type: "timestamptz", nullable: false },
        { name: "birth_date", type: "date", nullable: false },
        { name: "meta", type: "jsonb", nullable: false },
      ],
    },
  ],
};

describe("createFakerProvider with the real @faker-js/faker", () => {
  it("generates every column without throwing (validates real method names)", () => {
    const provider = createFakerProvider(faker);
    const rows = generateRows(SCHEMA, { rowsPerTable: 10, seed: 1, provider });
    const data = rows["public.kitchen_sink"];
    expect(data).toHaveLength(10);

    for (const r of data) {
      expect(String(r.email)).toContain("@");
      expect(typeof r.username).toBe("string");
      expect((r.username as string).length).toBeGreaterThan(0);
      expect(String(r.avatar_url).length).toBeGreaterThan(0);
      expect(String(r.website)).toMatch(/^https?:\/\//);
      expect(typeof r.order_total).toBe("number");
      expect(Number.isNaN(r.order_total as number)).toBe(false);
      expect(typeof r.age).toBe("number");
      expect(typeof r.published).toBe("boolean");
      expect(typeof r.ratio).toBe("number");
      expect(new Date(r.created_at as string).toString()).not.toBe("Invalid Date");
    }
  });

  it("loadFakerProvider() dynamically imports faker and returns a working provider", async () => {
    const provider = await loadFakerProvider();
    provider.seed(1);
    expect(String(provider.forType("uuid")())).toMatch(
      /^[0-9a-f-]{36}$/,
    );
    expect(String(provider.forName("email", "text")!())).toContain("@");
  });

  it("is deterministic across runs with the same seed", () => {
    const a = generateRows(SCHEMA, {
      rowsPerTable: 5,
      seed: 99,
      provider: createFakerProvider(faker),
    });
    const b = generateRows(SCHEMA, {
      rowsPerTable: 5,
      seed: 99,
      provider: createFakerProvider(faker),
    });
    expect(b).toEqual(a);
  });
});
