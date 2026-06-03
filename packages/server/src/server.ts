/** createFakebaseServer — runtime-agnostic Supabase-wire handler over the kernel. */
import type { FakebaseKernel } from "@byronwade/core";
import { handleRest, handleRpc } from "./rest/handler.js";
import { handleAuth } from "./auth/handler.js";
import { handleStorage } from "./storage/handler.js";
import { handleRealtimeConnection, handleBroadcastHttp, RealtimeHub } from "./realtime/server.js";
import { withCors, type CorsOption } from "./cors.js";
import { errorJson, toErrorResponse } from "./errors.js";
import type { AuthConfig } from "./context.js";
import { listen as nodeListen } from "./node.js";

/** Well-known dev defaults (mirrors `supabase start`'s static keys). */
export const DEV_ANON_KEY = "fakebase-anon-key";
export const DEV_SERVICE_KEY = "fakebase-service-role-key";
export const DEV_JWT_SECRET = "fakebase-super-secret-jwt-token-with-at-least-32-characters";

export interface FakebaseServerOptions {
  kernel: FakebaseKernel;
  anonKey?: string;
  serviceKey?: string;
  jwtSecret?: string;
  cors?: CorsOption;
}

export interface FakebaseServer {
  fetch(req: Request): Promise<Response>;
  listen(port?: number): Promise<{ url: string; close(): Promise<void> }>;
  anonKey: string;
  serviceKey: string;
}

export function createFakebaseServer(opts: FakebaseServerOptions): FakebaseServer {
  const { kernel } = opts;
  const cors: CorsOption = opts.cors ?? true;
  const authCfg: AuthConfig = {
    anonKey: opts.anonKey ?? DEV_ANON_KEY,
    serviceKey: opts.serviceKey ?? DEV_SERVICE_KEY,
    jwtSecret: opts.jwtSecret ?? DEV_JWT_SECRET,
  };
  // Shared across HTTP (the broadcast API) and the ws connections.
  const hub = new RealtimeHub();

  async function route(req: Request, url: URL): Promise<Response> {
    const path = url.pathname;
    if (path === "/realtime/v1/api/broadcast" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      return handleBroadcastHttp(body, hub);
    }
    if (path.startsWith("/rest/v1/rpc/")) {
      return handleRpc(req, decodeURIComponent(path.slice("/rest/v1/rpc/".length)), kernel, authCfg);
    }
    if (path.startsWith("/rest/v1/")) {
      const table = decodeURIComponent(path.slice("/rest/v1/".length));
      if (!table) return errorJson(404, { message: "No table specified" });
      return handleRest(req, url, table, kernel, authCfg);
    }
    if (path.startsWith("/auth/v1/")) {
      return handleAuth(req, url, kernel, authCfg);
    }
    if (path.startsWith("/storage/v1/")) {
      return handleStorage(req, url, kernel, authCfg);
    }
    if (path === "/health" || path === "/") {
      return new Response(JSON.stringify({ status: "ok", service: "fakebase" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return errorJson(404, { message: `Not found: ${path}`, code: "PGRST404" });
  }

  async function fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), cors, origin);
    }
    let res: Response;
    try {
      res = await route(req, url);
    } catch (err) {
      res = toErrorResponse(err);
    }
    return withCors(res, cors, origin);
  }

  return {
    fetch,
    listen: (port?: number) =>
      nodeListen(fetch, port, {
        onRealtime: (socket) => handleRealtimeConnection(socket, kernel, hub),
      }),
    anonKey: authCfg.anonKey,
    serviceKey: authCfg.serviceKey,
  };
}
