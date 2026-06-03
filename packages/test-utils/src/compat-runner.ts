/**
 * Compatibility runner — compares Fakebase behaviour against a real Supabase client.
 *
 * Run each scenario against Fakebase (and optionally real Supabase), compare
 * results, and return a structured CompatReport array.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A minimal Supabase-shaped client interface sufficient for compat testing. */
export type SupabaseLikeClient = {
  from(table: string): unknown;
  auth: unknown;
  storage: unknown;
};

/** A single compatibility test scenario. */
export interface CompatScenario {
  name: string;
  /** Execute the scenario against the given client and return the raw result. */
  run: (client: SupabaseLikeClient) => Promise<unknown>;
  /**
   * Optional shape validator.
   * If provided, `EXACT` is only granted when the result passes this check.
   */
  expectedShape?: (result: unknown) => boolean;
}

/** Outcome of running one scenario against both clients. */
export interface CompatReport {
  scenario: string;
  status: "EXACT" | "CLOSE" | "PARTIAL" | "UNSUPPORTED" | "ERROR";
  fakebaseResult?: unknown;
  supabaseResult?: unknown;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Deep equality helper
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    if (!deepEqual(aKeys, bKeys)) return false;
    return aKeys.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

/** True when two results are "close" — same shape but possibly different values. */
function shapesMatch(a: unknown, b: unknown): boolean {
  if (a === null && b === null) return true;
  if (Array.isArray(a) && Array.isArray(b)) return true;
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    const aKeys = Object.keys(a as object).sort();
    const bKeys = Object.keys(b as object).sort();
    return deepEqual(aKeys, bKeys);
  }
  return typeof a === typeof b;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run all scenarios against Fakebase (and optionally a real Supabase client).
 *
 * When `supabaseClient` is omitted every scenario is marked `PARTIAL` — the
 * result was obtained from Fakebase only, so a comparison is impossible.
 */
export async function runCompatSuite(
  scenarios: CompatScenario[],
  fakebaseClient: SupabaseLikeClient,
  supabaseClient?: SupabaseLikeClient,
): Promise<CompatReport[]> {
  const reports: CompatReport[] = [];

  for (const scenario of scenarios) {
    let fakebaseResult: unknown;
    let supabaseResult: unknown;
    let fbError: unknown;
    let sbError: unknown;

    // Run against Fakebase
    try {
      fakebaseResult = await scenario.run(fakebaseClient);
    } catch (err) {
      fbError = err;
    }

    // Run against real Supabase (optional)
    if (supabaseClient) {
      try {
        supabaseResult = await scenario.run(supabaseClient);
      } catch (err) {
        sbError = err;
      }
    }

    // Determine status
    let status: CompatReport["status"];
    let notes: string | undefined;

    if (fbError) {
      status = "ERROR";
      notes = `Fakebase threw: ${fbError instanceof Error ? fbError.message : String(fbError)}`;
    } else if (!supabaseClient) {
      status = "PARTIAL";
      notes = "No Supabase client provided; result is Fakebase-only.";
    } else if (sbError) {
      status = "CLOSE";
      notes = `Supabase threw: ${sbError instanceof Error ? sbError.message : String(sbError)}`;
    } else if (deepEqual(fakebaseResult, supabaseResult)) {
      status = "EXACT";
      if (scenario.expectedShape && !scenario.expectedShape(fakebaseResult)) {
        status = "CLOSE";
        notes = "Results are identical but fail the expectedShape validator.";
      }
    } else if (shapesMatch(fakebaseResult, supabaseResult)) {
      status = "CLOSE";
      notes = "Results have the same shape but different values.";
    } else {
      status = "PARTIAL";
      notes = "Results have different shapes or types.";
    }

    reports.push({
      scenario: scenario.name,
      status,
      fakebaseResult,
      ...(supabaseClient && { supabaseResult }),
      ...(notes && { notes }),
    });
  }

  return reports;
}

// ---------------------------------------------------------------------------
// Default scenario set
// ---------------------------------------------------------------------------

/**
 * A default set of 10+ compatibility scenarios covering the most common
 * Supabase client operations.
 *
 * These scenarios assume the client has a `users` table matching `TEST_SCHEMA`.
 */
export const DEFAULT_COMPAT_SCENARIOS: CompatScenario[] = [
  {
    name: "insert a single user row",
    run: async (client) => {
      const q = client.from("users") as {
        insert: (data: unknown) => Promise<unknown>;
      };
      return q.insert({
        email: "compat@example.com",
        name: "Compat User",
        role: "user",
      });
    },
  },
  {
    name: "select all users",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string) => Promise<unknown>;
      };
      return q.select("*");
    },
    expectedShape: (result) =>
      result !== null && typeof result === "object" && "data" in (result as object),
  },
  {
    name: "select with eq filter",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string) => {
          eq: (col: string, val: unknown) => Promise<unknown>;
        };
      };
      return q.select("*").eq("role", "admin");
    },
  },
  {
    name: "insert then select single",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string) => { single: () => Promise<unknown> };
      };
      return q.select("*").single();
    },
    expectedShape: (result) => result !== null && typeof result === "object",
  },
  {
    name: "select with maybeSingle on empty",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string) => {
          eq: (col: string, val: unknown) => { maybeSingle: () => Promise<unknown> };
        };
      };
      return q.select("*").eq("id", "non-existent-id").maybeSingle();
    },
  },
  {
    name: "update by id",
    run: async (client) => {
      const q = client.from("users") as {
        update: (patch: unknown) => {
          eq: (col: string, val: unknown) => Promise<unknown>;
        };
      };
      return q.update({ name: "Updated Name" }).eq("id", "test-id");
    },
  },
  {
    name: "delete by filter",
    run: async (client) => {
      const q = client.from("users") as {
        delete: () => { eq: (col: string, val: unknown) => Promise<unknown> };
      };
      return q.delete().eq("id", "non-existent-id");
    },
  },
  {
    name: "upsert a row",
    run: async (client) => {
      const q = client.from("users") as {
        upsert: (data: unknown) => Promise<unknown>;
      };
      return q.upsert({ id: "upsert-test", email: "upsert@example.com", role: "user" });
    },
  },
  {
    name: "select with ordering",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<unknown>;
        };
      };
      return q.select("*").order("created_at", { ascending: false });
    },
  },
  {
    name: "select with limit",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string) => {
          limit: (n: number) => Promise<unknown>;
        };
      };
      return q.select("*").limit(5);
    },
    expectedShape: (result) =>
      result !== null && typeof result === "object" && "data" in (result as object),
  },
  {
    name: "select with range",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string) => {
          range: (from: number, to: number) => Promise<unknown>;
        };
      };
      return q.select("*").range(0, 4);
    },
  },
  {
    name: "count rows with exact count",
    run: async (client) => {
      const q = client.from("users") as {
        select: (cols: string, opts: { count: string }) => Promise<unknown>;
      };
      return q.select("*", { count: "exact" });
    },
    expectedShape: (result) =>
      result !== null && typeof result === "object" && "count" in (result as object),
  },
];
