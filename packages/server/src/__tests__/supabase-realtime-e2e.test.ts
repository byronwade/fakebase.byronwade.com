/**
 * Real @supabase/supabase-js realtime client against the Fakebase ws server:
 * subscribe to postgres_changes, mutate over REST, receive the event.
 */
import { describe, it, expect, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createMemoryKernel } from "@byronwade/adapter-memory";
import type { ProjectSchemaIR } from "@byronwade/core";
import { createFakebaseServer, DEV_ANON_KEY } from "../index.js";

const schema: ProjectSchemaIR = {
  version: 1,
  enums: [],
  functions: [],
  tables: [
    {
      schema: "public",
      name: "posts",
      primaryKey: "id",
      rlsEnabled: false,
      policies: [],
      indexes: [],
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true, defaultSql: "gen_random_uuid()" },
        { name: "title", type: "text", nullable: false },
      ],
    },
  ],
};

let cleanup: (() => Promise<void>) | null = null;
afterEach(async () => {
  await cleanup?.();
  cleanup = null;
});

const PORT = 54397;

describe("real supabase-js realtime against Fakebase ws server", () => {
  it("delivers a postgres_changes INSERT event over websockets", async () => {
    const server = createFakebaseServer({ kernel: createMemoryKernel(schema) });
    const { url, close } = await server.listen(PORT);
    const supabase: SupabaseClient = createClient(url, DEV_ANON_KEY);
    cleanup = async () => {
      await supabase.removeAllChannels();
      await close();
    };

    const received: Array<{ new: Record<string, unknown> }> = [];
    const channel = supabase
      .channel("posts-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (p) =>
        received.push(p as never),
      );

    const status = await new Promise<string>((resolve) => {
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED" || s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve(s);
      });
      setTimeout(() => resolve("NO_CALLBACK"), 5000);
    });
    expect(status).toBe("SUBSCRIBED");

    await supabase.from("posts").insert({ title: "live-event" });

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const tick = setInterval(() => {
        if (received.length > 0) {
          clearInterval(tick);
          resolve();
        } else if (Date.now() - start > 3000) {
          clearInterval(tick);
          reject(new Error("no realtime event received"));
        }
      }, 50);
    });

    expect(received[0]?.new?.title).toBe("live-event");
  }, 15000);
});
