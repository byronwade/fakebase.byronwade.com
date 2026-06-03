/**
 * Per-visitor Fakebase sandbox registry (server-only).
 *
 * Each visitor gets their own isolated in-memory kernel keyed by the `fb_pg`
 * cookie (set by middleware). `createMemoryKernel` builds a fresh adapter, auth
 * service, and storage per call, so sessions and data are per-visitor by
 * construction.
 *
 * Designed to degrade: a missing kernel (cold serverless instance, eviction)
 * is lazily re-seeded rather than erroring — worst case is a fresh sandbox.
 */
import "server-only";
import { cookies } from "next/headers";
import { createClient, createMemoryKernel } from "fakebase";
import { seedClient } from "@fakebase/seed";
import type { Database } from "@/lib/playground/database.types";
import { playgroundSchema, playgroundSeed } from "@/lib/playground/schema";
import { PLAYGROUND_COOKIE } from "@/lib/playground/cookie";

type Client = ReturnType<typeof createClient<Database>>;
// Store the in-flight promise so concurrent first-hits for one visitor share a
// single sandbox instead of racing to build two.
type Entry = { client: Promise<Client>; lastSeen: number };

const MAX_SANDBOXES = 500;
const TTL_MS = 30 * 60 * 1000; // 30 minutes idle

// Survive dev HMR / module reloads.
const g = globalThis as unknown as {
  __fbPlayground?: Map<string, Entry>;
};
const registry: Map<string, Entry> = (g.__fbPlayground ??= new Map());

async function createSeededClient(): Promise<Client> {
  const kernel = createMemoryKernel<Database>(playgroundSchema);
  // Curated baseline: the known demo user + a couple of posts the auth/CRUD
  // walkthrough references.
  kernel.restore(playgroundSeed);
  const client = createClient<Database>("local", "dev-key", { kernel });
  // Enrich the sandbox with realistic, schema-derived data via @fakebase/seed —
  // the same feature the docs describe, running live. Deterministic per visitor.
  // `force` because the curated baseline already populated some tables.
  await seedClient(client, playgroundSchema, {
    force: true,
    seed: 7,
    tables: { users: 4, posts: 6, comments: 14 },
  });
  return client;
}

function evictStale(now: number): void {
  for (const [id, entry] of registry) {
    if (now - entry.lastSeen > TTL_MS) registry.delete(id);
  }
  // Hard cap: drop oldest entries first.
  if (registry.size > MAX_SANDBOXES) {
    const sorted = [...registry.entries()].sort(
      (a, b) => a[1].lastSeen - b[1].lastSeen,
    );
    for (const [id] of sorted.slice(0, registry.size - MAX_SANDBOXES)) {
      registry.delete(id);
    }
  }
}

async function sessionId(): Promise<string> {
  const store = await cookies();
  // Fallback keeps reads working even if middleware hasn't set the cookie yet.
  return store.get(PLAYGROUND_COOKIE)?.value ?? "anon";
}

/** Get (or lazily create + seed) the calling visitor's sandbox client. */
export async function getPlaygroundClient(): Promise<Client> {
  const id = await sessionId();
  const now = Date.now();
  let entry = registry.get(id);
  if (!entry) {
    // Register the in-flight promise synchronously so a second concurrent
    // request reuses it rather than building a second sandbox.
    entry = { client: createSeededClient(), lastSeen: now };
    // Don't cache a failed build — let the next request retry.
    entry.client.catch(() => registry.delete(id));
    registry.set(id, entry);
  }
  entry.lastSeen = now;
  evictStale(now);
  return entry.client;
}

/** Drop the visitor's sandbox so the next read re-seeds it. */
export async function resetPlayground(): Promise<void> {
  registry.delete(await sessionId());
}
