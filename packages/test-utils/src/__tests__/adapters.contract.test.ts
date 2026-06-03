import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

import type { FakebaseAdapter } from "@fakebase/core";
import { MemoryAdapter } from "@fakebase/adapter-memory";
import { JsonAdapter } from "@fakebase/adapter-json";
import { SqliteAdapter } from "@fakebase/adapter-sqlite";
import { PGliteAdapter } from "@fakebase/adapter-pglite";

import { defineAdapterContractSuite } from "../contract-suite.js";
import { TEST_SCHEMA } from "../fixtures.js";

/**
 * Cross-adapter contract verification.
 *
 * Every adapter that backs Fakebase must satisfy the exact same behavioural
 * contract (CRUD, filters, ordering, pagination, upsert, RLS). Running the one
 * shared suite against memory, JSON, SQLite, and PGlite is how we guarantee
 * that swapping the persistence layer never changes observable behaviour.
 */

function uniqueTmp(suffix = ""): string {
  return join(
    tmpdir(),
    `fakebase-contract-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`,
  );
}

// In-memory ----------------------------------------------------------------
defineAdapterContractSuite("MemoryAdapter", async () => {
  const adapter = new MemoryAdapter();
  adapter.initialize(TEST_SCHEMA);
  return adapter;
});

// File-backed JSON ----------------------------------------------------------
interface DirTagged {
  __contractDir?: string;
}

defineAdapterContractSuite(
  "JsonAdapter",
  async () => {
    const dir = uniqueTmp();
    const adapter = new JsonAdapter({ dir });
    adapter.initialize(TEST_SCHEMA);
    (adapter as FakebaseAdapter & DirTagged).__contractDir = dir;
    return adapter;
  },
  async (adapter) => {
    await adapter.close();
    const dir = (adapter as FakebaseAdapter & DirTagged).__contractDir;
    if (dir) rmSync(dir, { recursive: true, force: true });
  },
);

// SQLite (WAL) --------------------------------------------------------------
interface PathTagged {
  __contractPath?: string;
}

defineAdapterContractSuite(
  "SqliteAdapter",
  async () => {
    const dbPath = uniqueTmp(".db");
    const adapter = new SqliteAdapter({ dbPath });
    adapter.initialize(TEST_SCHEMA);
    (adapter as FakebaseAdapter & PathTagged).__contractPath = dbPath;
    return adapter;
  },
  async (adapter) => {
    await adapter.close();
    const dbPath = (adapter as FakebaseAdapter & PathTagged).__contractPath;
    if (dbPath) {
      for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
        rmSync(f, { force: true });
      }
    }
  },
);

// PGlite (Postgres-in-WASM) -------------------------------------------------
defineAdapterContractSuite(
  "PGliteAdapter",
  async () => {
    const dir = uniqueTmp("-pg");
    const adapter = new PGliteAdapter({ dataDir: dir });
    adapter.initialize(TEST_SCHEMA);
    (adapter as FakebaseAdapter & DirTagged).__contractDir = dir;
    return adapter;
  },
  async (adapter) => {
    await adapter.close();
    const dir = (adapter as FakebaseAdapter & DirTagged).__contractDir;
    if (dir) rmSync(dir, { recursive: true, force: true });
  },
);
