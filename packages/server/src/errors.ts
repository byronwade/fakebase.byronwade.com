/** PostgREST-shaped error responses. */
import { CapabilityError } from "@byronwade/core";

export interface PgrstError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export function errorJson(status: number, err: PgrstError): Response {
  return new Response(JSON.stringify(err), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Map an unexpected/thrown error to a PostgREST error Response. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof CapabilityError) {
    return errorJson(501, { message: err.message, code: "PGRST000", hint: "Unsupported by Fakebase" });
  }
  const message = err instanceof Error ? err.message : String(err);
  return errorJson(400, { message });
}
