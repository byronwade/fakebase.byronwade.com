/**
 * @byronwade/server — a local HTTP server that speaks the Supabase wire
 * protocol (PostgREST + GoTrue), backed by the Fakebase kernel. Point the real
 * `@supabase/supabase-js` at it and it works as a drop-in.
 */
export {
  createFakebaseServer,
  DEV_ANON_KEY,
  DEV_SERVICE_KEY,
  DEV_JWT_SECRET,
} from "./server.js";
export type { FakebaseServer, FakebaseServerOptions } from "./server.js";
export { signJwt, verifyJwt } from "./auth/jwt.js";
export type { JwtClaims } from "./auth/jwt.js";
export { parseRestRequest } from "./rest/parse.js";
export type { ParseInput } from "./rest/parse.js";
