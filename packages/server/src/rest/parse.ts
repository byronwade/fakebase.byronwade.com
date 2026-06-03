/**
 * PostgREST request → `QueryPlan`.
 *
 * The kernel already consumes a Supabase-shaped `QueryPlan`; this module is the
 * inverse of the client's `DatabaseBuilder` — it turns an HTTP request (method,
 * query string, headers, body) into that same plan, so the real
 * `@supabase/supabase-js` drives the kernel over HTTP.
 */
import type {
  FilterItem,
  OrderItem,
  PlanOperation,
  QueryPlan,
  SimpleFilter,
} from "@byronwade/core";

/** Reserved query keys that are not column filters. */
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "and", "or"]);

/** Coerce a PostgREST scalar literal to a JS value. Quoted values stay strings. */
function coerceScalar(raw: string): unknown {
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/** Parse `(a,b,c)` (used by `in`) into an array of coerced scalars. */
function parseList(raw: string): unknown[] {
  const inner = raw.replace(/^\(/, "").replace(/\)$/, "");
  if (inner === "") return [];
  return inner.split(",").map((v) => coerceScalar(v.trim()));
}

/** Parse a filter value like `eq.true`, `not.eq.x`, `in.(1,2)`, `is.null`. */
function parseSimpleFilter(column: string, raw: string): SimpleFilter {
  let rest = raw;
  let negate = false;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  const operator = dot === -1 ? "eq" : rest.slice(0, dot);
  const valueRaw = dot === -1 ? "" : rest.slice(dot + 1);
  const value = operator === "in" ? parseList(valueRaw) : coerceScalar(valueRaw);
  return { type: "simple", column, operator, value, ...(negate ? { negate } : {}) };
}

/** Parse the contents of `or=(...)` / `and=(...)` into filter items. */
function parseLogicalGroup(raw: string): FilterItem[] {
  const inner = raw.replace(/^\(/, "").replace(/\)$/, "");
  if (inner === "") return [];
  // Split on top-level commas (no nested groups in Phase 1).
  return inner.split(",").map((clause) => {
    const dot = clause.indexOf(".");
    const column = clause.slice(0, dot);
    return parseSimpleFilter(column, clause.slice(dot + 1));
  });
}

function parseOrder(raw: string): OrderItem[] {
  return raw.split(",").map((spec) => {
    const [column, ...mods] = spec.split(".");
    return {
      column: column!,
      ascending: !mods.includes("desc"),
      ...(mods.includes("nullsfirst")
        ? { nullsFirst: true }
        : mods.includes("nullslast")
          ? { nullsFirst: false }
          : {}),
    };
  });
}

function headerGet(headers: Headers | Record<string, string>, name: string): string | null {
  if (headers instanceof Headers) return headers.get(name);
  const found = Object.entries(headers).find(([k]) => k.toLowerCase() === name.toLowerCase());
  return found ? found[1] : null;
}

function parsePrefer(headers: Headers | Record<string, string>): Record<string, string> {
  const raw = headerGet(headers, "prefer") ?? "";
  const out: Record<string, string> = {};
  for (const part of raw.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) out[k.trim()] = v.trim();
  }
  return out;
}

export interface ParseInput {
  method: string;
  schema?: string;
  table: string;
  searchParams: URLSearchParams;
  headers: Headers | Record<string, string>;
  body?: unknown;
}

export function parseRestRequest(input: ParseInput): QueryPlan {
  const { method, table, searchParams, headers, body } = input;
  const prefer = parsePrefer(headers);

  // Filters, select, order, pagination from the query string.
  const filters: FilterItem[] = [];
  let select: string[] | undefined;
  let orderBy: OrderItem[] = [];
  let limit: number | undefined;
  let offset: number | undefined;
  let onConflict: string | undefined;

  for (const [key, value] of searchParams.entries()) {
    if (key === "select") {
      select = value === "*" ? undefined : value.split(",").map((c) => c.trim());
    } else if (key === "order") {
      orderBy = parseOrder(value);
    } else if (key === "limit") {
      limit = Number(value);
    } else if (key === "offset") {
      offset = Number(value);
    } else if (key === "on_conflict") {
      onConflict = value;
    } else if (key === "or") {
      filters.push({ type: "or", filters: parseLogicalGroup(value) });
    } else if (key === "and") {
      filters.push({ type: "and", filters: parseLogicalGroup(value) });
    } else if (!RESERVED.has(key)) {
      filters.push(parseSimpleFilter(key, value));
    }
  }

  // The Range header is an alternative to limit/offset (0-based inclusive).
  const range = headerGet(headers, "range");
  if (range && offset === undefined && limit === undefined) {
    const [from, to] = range.split("-").map(Number);
    if (!Number.isNaN(from)) {
      offset = from;
      if (to !== undefined && !Number.isNaN(to)) limit = to - from + 1;
    }
  }

  const returning = prefer["return"] === "representation";
  const count =
    prefer["count"] === "exact" || prefer["count"] === "planned" || prefer["count"] === "estimated"
      ? (prefer["count"] as "exact" | "planned" | "estimated")
      : undefined;

  // Method → operation (POST + merge-duplicates = upsert).
  let operation: PlanOperation;
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD") operation = "select";
  else if (m === "POST")
    operation = prefer["resolution"] === "merge-duplicates" ? "upsert" : "insert";
  else if (m === "PATCH" || m === "PUT") operation = "update";
  else if (m === "DELETE") operation = "delete";
  else operation = "select";

  const asArray = (b: unknown): Record<string, unknown>[] =>
    Array.isArray(b) ? (b as Record<string, unknown>[]) : b ? [b as Record<string, unknown>] : [];

  const plan: QueryPlan = {
    schema: input.schema ?? "public",
    table,
    operation,
    filters,
    select,
    orderBy,
    ...(limit !== undefined ? { limit } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(count ? { count } : {}),
    ...(returning ? { returning } : {}),
  };

  if (operation === "insert") plan.insertData = asArray(body);
  else if (operation === "upsert") {
    plan.upsertData = asArray(body);
    if (onConflict) plan.onConflict = onConflict;
    if (prefer["resolution"] === "ignore-duplicates") plan.ignoreDuplicates = true;
  } else if (operation === "update") {
    plan.updateData = (body ?? {}) as Record<string, unknown>;
  }

  return plan;
}
