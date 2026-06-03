/** Shape a KernelQueryResult into a PostgREST-style HTTP Response. */
import type { KernelQueryResult, QueryPlan } from "@byronwade/core";
import { errorJson } from "../errors.js";

const OBJECT_ACCEPT = "application/vnd.pgrst.object+json";

export function shapeRestResponse(
  result: KernelQueryResult,
  plan: QueryPlan,
  req: Request,
): Response {
  const rows = result.rows;
  const isMutation = plan.operation !== "select";
  const wantsObject = (req.headers.get("accept") ?? "").includes(OBJECT_ACCEPT);

  // Mutation without `return=representation` → no body.
  if (isMutation && !plan.returning) {
    return new Response(null, { status: plan.operation === "insert" || plan.operation === "upsert" ? 201 : 204 });
  }

  if (wantsObject) {
    if (rows.length === 1) {
      return new Response(JSON.stringify(rows[0]), {
        status: isMutation ? 201 : 200,
        headers: { "content-type": OBJECT_ACCEPT },
      });
    }
    return errorJson(406, {
      message: `JSON object requested, multiple (or no) rows returned`,
      code: "PGRST116",
    });
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (plan.count !== undefined && result.count !== undefined) {
    const from = plan.offset ?? 0;
    const to = rows.length > 0 ? from + rows.length - 1 : 0;
    headers["content-range"] = `${from}-${to}/${result.count}`;
  }
  const status =
    plan.operation === "insert" || plan.operation === "upsert" ? 201 : 200;
  return new Response(JSON.stringify(rows), { status, headers });
}
