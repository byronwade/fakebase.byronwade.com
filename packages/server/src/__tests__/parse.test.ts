import { describe, it, expect } from "vitest";
import { parseRestRequest } from "../rest/parse.js";

function parse(
  method: string,
  query = "",
  opts: { headers?: Record<string, string>; body?: unknown } = {},
) {
  return parseRestRequest({
    method,
    table: "posts",
    searchParams: new URLSearchParams(query),
    headers: new Headers(opts.headers ?? {}),
    body: opts.body,
  });
}

describe("parseRestRequest — operation", () => {
  it("maps HTTP methods to plan operations", () => {
    expect(parse("GET").operation).toBe("select");
    expect(parse("POST", "", { body: { title: "x" } }).operation).toBe("insert");
    expect(parse("PATCH", "id=eq.1", { body: { title: "x" } }).operation).toBe("update");
    expect(parse("DELETE", "id=eq.1").operation).toBe("delete");
  });

  it("POST with Prefer resolution=merge-duplicates is an upsert", () => {
    const plan = parse("POST", "", {
      headers: { Prefer: "resolution=merge-duplicates" },
      body: { id: "1", title: "x" },
    });
    expect(plan.operation).toBe("upsert");
    expect(plan.upsertData).toEqual([{ id: "1", title: "x" }]);
  });
});

describe("parseRestRequest — filters", () => {
  it("parses col=op.value into SimpleFilter with coercion", () => {
    const plan = parse("GET", "published=eq.true&views=gte.10&title=eq.hello");
    expect(plan.filters).toEqual([
      { type: "simple", column: "published", operator: "eq", value: true },
      { type: "simple", column: "views", operator: "gte", value: 10 },
      { type: "simple", column: "title", operator: "eq", value: "hello" },
    ]);
  });

  it("parses in.(a,b,c) into an array", () => {
    const plan = parse("GET", "id=in.(1,2,3)");
    expect(plan.filters[0]).toEqual({
      type: "simple",
      column: "id",
      operator: "in",
      value: [1, 2, 3],
    });
  });

  it("parses is.null", () => {
    const plan = parse("GET", "deleted_at=is.null");
    expect(plan.filters[0]).toMatchObject({ operator: "is", value: null });
  });

  it("parses not.op.value as a negated filter", () => {
    const plan = parse("GET", "status=not.eq.draft");
    expect(plan.filters[0]).toMatchObject({
      column: "status",
      operator: "eq",
      value: "draft",
      negate: true,
    });
  });

  it("parses or=(...) into an OrFilter", () => {
    const plan = parse("GET", "or=(views.gt.100,featured.eq.true)");
    expect(plan.filters[0]).toEqual({
      type: "or",
      filters: [
        { type: "simple", column: "views", operator: "gt", value: 100 },
        { type: "simple", column: "featured", operator: "eq", value: true },
      ],
    });
  });
});

describe("parseRestRequest — shaping", () => {
  it("parses select projection (undefined for *)", () => {
    expect(parse("GET", "select=*").select).toBeUndefined();
    expect(parse("GET", "select=id,title").select).toEqual(["id", "title"]);
  });

  it("parses order with direction and nullsfirst", () => {
    const plan = parse("GET", "order=created_at.desc.nullsfirst");
    expect(plan.orderBy).toEqual([
      { column: "created_at", ascending: false, nullsFirst: true },
    ]);
  });

  it("parses limit/offset", () => {
    const plan = parse("GET", "limit=10&offset=20");
    expect(plan.limit).toBe(10);
    expect(plan.offset).toBe(20);
  });

  it("parses the Range header into offset/limit (0-based inclusive)", () => {
    const plan = parse("GET", "", { headers: { Range: "0-9" } });
    expect(plan.offset).toBe(0);
    expect(plan.limit).toBe(10);
  });

  it("Prefer count=exact sets count", () => {
    expect(parse("GET", "", { headers: { Prefer: "count=exact" } }).count).toBe("exact");
  });

  it("Prefer return=representation sets returning on a mutation", () => {
    const plan = parse("POST", "", {
      headers: { Prefer: "return=representation" },
      body: { title: "x" },
    });
    expect(plan.returning).toBe(true);
  });
});

describe("parseRestRequest — bodies", () => {
  it("insert wraps a single object into an array", () => {
    expect(parse("POST", "", { body: { title: "x" } }).insertData).toEqual([{ title: "x" }]);
  });
  it("insert accepts an array", () => {
    expect(parse("POST", "", { body: [{ title: "x" }, { title: "y" }] }).insertData).toHaveLength(2);
  });
  it("update keeps a single object and the filters", () => {
    const plan = parse("PATCH", "id=eq.1", { body: { title: "x" } });
    expect(plan.updateData).toEqual({ title: "x" });
    expect(plan.filters[0]).toMatchObject({ column: "id", operator: "eq", value: 1 });
  });
});
