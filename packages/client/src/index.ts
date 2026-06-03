/**
 * @fakebase/client — public API barrel.
 */

export { DatabaseBuilder } from "./database-builder.js";
export type { FakebaseResponse } from "./database-builder.js";

export { createAuthClient } from "./auth-client.js";
export type { AuthClientFacade } from "./auth-client.js";

export { createStorageClient } from "./storage-client.js";
export type { StorageClientFacade } from "./storage-client.js";

export { createRealtimeClient, Channel } from "./realtime-client.js";
export type { RealtimeClientFacade, RealtimeClient } from "./realtime-client.js";

export { createFunctionsClient } from "./functions-client.js";
export type { FunctionsClientFacade } from "./functions-client.js";

export { createClient } from "./create-client.js";
export type { FakebaseClient, FakebaseClientOptions } from "./create-client.js";
