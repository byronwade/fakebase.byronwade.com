/** /rest/v1/:table and /rest/v1/rpc/:fn handlers. */
import type { FakebaseKernel } from "@byronwade/core";
import { parseRestRequest } from "./parse.js";
import { shapeRestResponse } from "./response.js";
import { parseSelect, resolveEmbeds } from "./embed.js";
import { resolveRole, type AuthConfig } from "../context.js";
import { errorJson } from "../errors.js";

async function readJson(req: Request): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "DELETE") return undefined;
  const text = await req.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function handleRest(
  req: Request,
  url: URL,
  table: string,
  kernel: FakebaseKernel,
  auth: AuthConfig,
): Promise<Response> {
  kernel.setRole(resolveRole(req.headers, auth));
  const schema =
    req.headers.get("accept-profile") ?? req.headers.get("content-profile") ?? "public";
  const body = await readJson(req);
  const plan = parseRestRequest({
    method: req.method,
    schema,
    table,
    searchParams: url.searchParams,
    headers: req.headers,
    body,
  });

  // Embedded resources (`select=*,author(*)`) are resolved after the base query.
  const rawSelect = url.searchParams.get("select");
  const parsed = rawSelect?.includes("(") ? parseSelect(rawSelect) : null;
  if (parsed?.embeds.length) plan.select = undefined; // fetch all base cols for FK resolution

  const result = await kernel.query(plan);

  if (parsed?.embeds.length) {
    await resolveEmbeds(result.rows, parsed.embeds, schema, table, kernel.schema, (p) =>
      kernel.query(p),
    );
    if (parsed.columns) {
      const keep = new Set([...parsed.columns, ...parsed.embeds.map((e) => e.name)]);
      result.rows = result.rows.map((r) =>
        Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k))),
      );
    }
  }
  return shapeRestResponse(result, plan, req);
}

export async function handleRpc(
  req: Request,
  fn: string,
  kernel: FakebaseKernel,
  auth: AuthConfig,
): Promise<Response> {
  kernel.setRole(resolveRole(req.headers, auth));
  const text = await req.text();
  const args = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  const res = await kernel.functions.callRpc(fn, args);
  if (res.error) return errorJson(400, { message: res.error.message ?? "RPC error" });
  return new Response(JSON.stringify(res.data ?? null), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
