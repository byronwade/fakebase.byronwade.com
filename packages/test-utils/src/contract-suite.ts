import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FakebaseAdapter } from "@byronwade/core";

/** Adapters that support RLS role switching expose this method. */
interface RoleAwareAdapter extends FakebaseAdapter {
  setRoleContext(ctx: {
    role: "anon" | "authenticated" | "service_role";
    userId?: string;
  }): void;
}

function isRoleAware(adapter: FakebaseAdapter): adapter is RoleAwareAdapter {
  return typeof (adapter as RoleAwareAdapter).setRoleContext === "function";
}

/**
 * Define a complete adapter contract test suite.
 *
 * Call this function from an adapter's test file to verify it correctly
 * implements the `FakebaseAdapter` contract. The suite covers all standard
 * operations: insert, select, update, delete, upsert, filter operators,
 * ordering, pagination, and RLS enforcement.
 *
 * @param adapterName   Display name shown in test output.
 * @param createAdapter Factory that returns a fully-initialised adapter.
 * @param teardown      Optional cleanup called after every test.
 */
export function defineAdapterContractSuite(
  adapterName: string,
  createAdapter: () => Promise<FakebaseAdapter>,
  teardown?: (adapter: FakebaseAdapter) => Promise<void>,
): void {
  describe(`${adapterName} — adapter contract suite`, () => {
    let adapter: FakebaseAdapter;

    beforeEach(async () => {
      adapter = await createAdapter();
    });

    afterEach(async () => {
      if (teardown) await teardown(adapter);
      else await adapter.close();
    });

    // -----------------------------------------------------------------------
    // 1. Insert then select
    // -----------------------------------------------------------------------
    it("insert then select — returns the inserted row", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "email", operator: "eq", value: "alice@example.com" }],
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data![0]!.email).toBe("alice@example.com");
      expect(result.data![0]!.name).toBe("Alice");
    });

    // -----------------------------------------------------------------------
    // 2. Update with eq filter
    // -----------------------------------------------------------------------
    it("update with eq filter — modifies the matching row", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
      ]);

      await adapter.update("users", "public", { name: "Alicia" }, [
        { column: "id", operator: "eq", value: "u1" },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "id", operator: "eq", value: "u1" }],
      });

      expect(result.data![0]!.name).toBe("Alicia");
    });

    // -----------------------------------------------------------------------
    // 3. Delete with filter
    // -----------------------------------------------------------------------
    it("delete with filter — removes only the matching row", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
        {
          id: "u2",
          email: "bob@example.com",
          name: "Bob",
          age: 25,
          role: "user",
          metadata: null,
        },
      ]);

      await adapter.delete("users", "public", [
        { column: "email", operator: "eq", value: "alice@example.com" },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data![0]!.email).toBe("bob@example.com");
    });

    // -----------------------------------------------------------------------
    // 4. Upsert
    // -----------------------------------------------------------------------
    it("upsert — inserts on first call, updates on second call with same id", async () => {
      await adapter.upsert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
      ]);

      await adapter.upsert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alicia Updated",
          age: 31,
          role: "admin",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data![0]!.name).toBe("Alicia Updated");
      expect(result.data![0]!.age).toBe(31);
    });

    // -----------------------------------------------------------------------
    // 5. Filter operators
    // -----------------------------------------------------------------------
    it("filter gt — returns rows where age > 25", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
        {
          id: "u2",
          email: "bob@example.com",
          name: "Bob",
          age: 20,
          role: "user",
          metadata: null,
        },
        {
          id: "u3",
          email: "carol@example.com",
          name: "Carol",
          age: 28,
          role: "user",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "age", operator: "gt", value: 25 }],
      });

      expect(result.data!.length).toBe(2);
      expect(result.data!.every((r) => (r.age as number) > 25)).toBe(true);
    });

    it("filter lt — returns rows where age < 25", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
        {
          id: "u2",
          email: "bob@example.com",
          name: "Bob",
          age: 20,
          role: "user",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "age", operator: "lt", value: 25 }],
      });

      expect(result.data!.length).toBe(1);
      expect(result.data![0]!.name).toBe("Bob");
    });

    it("filter like — matches pattern", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice Smith",
          age: 30,
          role: "admin",
          metadata: null,
        },
        {
          id: "u2",
          email: "bob@example.com",
          name: "Bob Jones",
          age: 25,
          role: "user",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "name", operator: "like", value: "Alice%" }],
      });

      expect(result.data!.length).toBe(1);
      expect(result.data![0]!.name).toBe("Alice Smith");
    });

    it("filter ilike — matches pattern case-insensitively", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice Smith",
          age: 30,
          role: "admin",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "name", operator: "ilike", value: "alice%" }],
      });

      expect(result.data!.length).toBe(1);
    });

    it("filter in — matches a list of values", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
        {
          id: "u2",
          email: "bob@example.com",
          name: "Bob",
          age: 25,
          role: "user",
          metadata: null,
        },
        {
          id: "u3",
          email: "carol@example.com",
          name: "Carol",
          age: 28,
          role: "user",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "id", operator: "in", value: ["u1", "u3"] }],
      });

      expect(result.data!.length).toBe(2);
    });

    it("filter is null — matches null values", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: null,
          age: 30,
          role: "admin",
          metadata: null,
        },
        {
          id: "u2",
          email: "bob@example.com",
          name: "Bob",
          age: 25,
          role: "user",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [{ column: "name", operator: "is", value: null }],
      });

      expect(result.data!.length).toBe(1);
      expect(result.data![0]!.email).toBe("alice@example.com");
    });

    it("filter or — matches rows satisfying any branch (JS-evaluated tree)", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
        {
          id: "u2",
          email: "bob@example.com",
          name: "Bob",
          age: 20,
          role: "user",
          metadata: null,
        },
        {
          id: "u3",
          email: "carol@example.com",
          name: "Carol",
          age: 28,
          role: "user",
          metadata: null,
        },
      ]);

      // `or(name.eq.Alice, age.lt.22)` → Alice (name) + Bob (age) = 2 rows.
      // Logical nodes can't be pushed to SQL, so this exercises every adapter's
      // JS-side filter fallback uniformly.
      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [
          {
            type: "or",
            filters: [
              { column: "name", operator: "eq", value: "Alice" },
              { column: "age", operator: "lt", value: 22 },
            ],
          },
        ],
      });

      const names = (result.data ?? []).map((r) => r.name).sort();
      expect(names).toEqual(["Alice", "Bob"]);
    });

    // -----------------------------------------------------------------------
    // 6. Ordering
    // -----------------------------------------------------------------------
    it("ordering ascending — rows are sorted by age asc", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "a@example.com",
          name: "A",
          age: 30,
          role: "user",
          metadata: null,
        },
        {
          id: "u2",
          email: "b@example.com",
          name: "B",
          age: 20,
          role: "user",
          metadata: null,
        },
        {
          id: "u3",
          email: "c@example.com",
          name: "C",
          age: 25,
          role: "user",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [],
        orderBy: [{ column: "age", ascending: true }],
      });

      expect(result.data!.map((r) => r.age)).toEqual([20, 25, 30]);
    });

    it("ordering descending — rows are sorted by age desc", async () => {
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "a@example.com",
          name: "A",
          age: 30,
          role: "user",
          metadata: null,
        },
        {
          id: "u2",
          email: "b@example.com",
          name: "B",
          age: 20,
          role: "user",
          metadata: null,
        },
        {
          id: "u3",
          email: "c@example.com",
          name: "C",
          age: 25,
          role: "user",
          metadata: null,
        },
      ]);

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [],
        orderBy: [{ column: "age", ascending: false }],
      });

      expect(result.data!.map((r) => r.age)).toEqual([30, 25, 20]);
    });

    // -----------------------------------------------------------------------
    // 7. Limit and offset
    // -----------------------------------------------------------------------
    it("limit — returns only the requested number of rows", async () => {
      for (let i = 1; i <= 5; i++) {
        await adapter.insert("users", "public", [
          {
            id: `u${i}`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            age: i * 10,
            role: "user",
            metadata: null,
          },
        ]);
      }

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [],
        limit: 2,
        orderBy: [{ column: "age", ascending: true }],
      });

      expect(result.data!.length).toBe(2);
    });

    it("offset — skips the first N rows", async () => {
      for (let i = 1; i <= 5; i++) {
        await adapter.insert("users", "public", [
          {
            id: `u${i}`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            age: i * 10,
            role: "user",
            metadata: null,
          },
        ]);
      }

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [],
        offset: 2,
        limit: 2,
        orderBy: [{ column: "age", ascending: true }],
      });

      // After skipping the first 2 (age=10, age=20), we get age=30 and age=40
      expect(result.data!.length).toBe(2);
      expect(result.data![0]!.age).toBe(30);
      expect(result.data![1]!.age).toBe(40);
    });

    // -----------------------------------------------------------------------
    // 8. Range (offset + limit together as 0-based range)
    // -----------------------------------------------------------------------
    it("range — offset=1, limit=2 returns positions 1 and 2 (0-based)", async () => {
      for (let i = 1; i <= 4; i++) {
        await adapter.insert("users", "public", [
          {
            id: `u${i}`,
            email: `user${i}@example.com`,
            name: `User ${i}`,
            age: i * 10,
            role: "user",
            metadata: null,
          },
        ]);
      }

      const result = await adapter.select("users", "public", {
        table: "users",
        schema: "public",
        filters: [],
        offset: 1,
        limit: 2,
        orderBy: [{ column: "age", ascending: true }],
      });

      // Positions 1 and 2 in 0-based ordering: age=20, age=30
      expect(result.data!.length).toBe(2);
      expect(result.data![0]!.age).toBe(20);
      expect(result.data![1]!.age).toBe(30);
    });

    // -----------------------------------------------------------------------
    // 9. RLS default deny
    // -----------------------------------------------------------------------
    it("RLS default deny — anon role sees 0 rows when RLS is enabled with no policies", async () => {
      if (!isRoleAware(adapter)) {
        console.warn(
          `[contract-suite] Skipping RLS test: ${adapterName} does not implement setRoleContext`,
        );
        return;
      }

      // posts table has rlsEnabled=true with a policy for 'authenticated' only
      // An 'anon' user with no matching policy should get 0 rows
      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
      ]);
      await adapter.insert("posts", "public", [
        { id: "p1", user_id: "u1", title: "Secret Post", body: null, published: false },
      ]);

      adapter.setRoleContext({ role: "anon" });

      const result = await adapter.select("posts", "public", {
        table: "posts",
        schema: "public",
        filters: [],
      });

      expect(result.data!.length).toBe(0);
    });

    // -----------------------------------------------------------------------
    // 10. service_role bypasses RLS
    // -----------------------------------------------------------------------
    it("service_role bypasses RLS — can read even with RLS enabled", async () => {
      if (!isRoleAware(adapter)) {
        console.warn(
          `[contract-suite] Skipping RLS test: ${adapterName} does not implement setRoleContext`,
        );
        return;
      }

      await adapter.insert("users", "public", [
        {
          id: "u1",
          email: "alice@example.com",
          name: "Alice",
          age: 30,
          role: "admin",
          metadata: null,
        },
      ]);
      await adapter.insert("posts", "public", [
        {
          id: "p1",
          user_id: "u1",
          title: "Private Post",
          body: null,
          published: false,
        },
      ]);

      // Ensure service_role can always read
      adapter.setRoleContext({ role: "service_role" });

      const result = await adapter.select("posts", "public", {
        table: "posts",
        schema: "public",
        filters: [],
      });

      expect(result.data!.length).toBe(1);
    });
  });
}
