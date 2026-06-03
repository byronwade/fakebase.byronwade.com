/** /rest/v1/:table and /rest/v1/rpc/:fn handlers. */
import type { FakebaseKernel } from "@byronwade/core";
import { parseRestRequest } from "./parse.js";
import { shapeRestResponse } from "./response.js";
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
  const result = await kernel.query(plan);
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
