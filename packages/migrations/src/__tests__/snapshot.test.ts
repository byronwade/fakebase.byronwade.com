import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectSchemaIR } from "@fakebase/core";
import { SnapshotManager } from "../snapshot.js";

const schema: ProjectSchemaIR = { version: 1, tables: [], enums: [], functions: [] };

describe("SnapshotManager", () => {
  let dir: string;
  let mgr: SnapshotManager;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "fb-snap-"));
    mgr = new SnapshotManager(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("deleting one snapshot leaves the others in the index", async () => {
    await mgr.save("alpha", schema, { "public.posts": [{ id: 1 }] });
    await mgr.save("beta", schema, { "public.posts": [{ id: 2 }] });
    expect(await mgr.list()).toHaveLength(2);

    await mgr.delete("alpha");

    const remaining = await mgr.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.label).toBe("beta");
    expect(await mgr.restore("beta")).not.toBeNull();
    expect(await mgr.restore("alpha")).toBeNull();
  });

  it("re-saving the same label does not duplicate its manifest entry", async () => {
    await mgr.save("alpha", schema, { "public.posts": [{ id: 1 }] });
    await mgr.save("alpha", schema, { "public.posts": [{ id: 2 }] });

    const list = await mgr.list();
    expect(list).toHaveLength(1);
    // The surviving entry reflects the latest save.
    expect((await mgr.restore("alpha"))?.data["public.posts"]).toEqual([{ id: 2 }]);
  });
});
