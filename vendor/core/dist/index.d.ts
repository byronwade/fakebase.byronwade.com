/**
 * @fakebase/core — public API surface.
 * Import from this entry point only; do not import sub-modules directly.
 */
export { FakebaseError, FakebaseErrorCode, CapabilityError, toSupabaseError, } from "./errors.js";
export { CapabilityStatus, CapabilityRegistry, type CapabilityEntry, } from "./capability.js";
export type { ColumnIR, ColumnType, EnumIR, FunctionIR, IndexIR, PolicyIR, ProjectSchemaIR, TableIR, } from "./schema/ir.js";
export { SchemaRegistry } from "./schema/registry.js";
export { applyFilter, parseOrString, type AndNode, type Filter, type FilterNode, type FilterOperator, type NotNode, type OrNode, } from "./query/filter.js";
export { compileQuery, type QueryOptions, type QueryResult } from "./query/compiler.js";
export type { AndFilter, FilterItem, KernelQueryResult, OrderItem, OrFilter, PlanFilterOperator, PlanOperation, QueryPlan, SimpleFilter, } from "./query/plan.js";
export { PolicyEngine, type RoleContext } from "./policy/engine.js";
export { EventBus, type EventHandler, type FakebaseEvent } from "./events/bus.js";
export { type AdapterRow, type AdapterTableState, type FakebaseAdapter, } from "./adapter.js";
export { FakeStore } from "./store.js";
export type { AuthAdminApi, AuthChangeEvent, AuthEngine, AuthResult, AuthSession, AuthUser, OtpRecord, SessionStorageAdapter, } from "./engines/auth.js";
export type { BucketRecord, CreateBucketOptions, CreateSignedUrlOptions, FileObject, FolderEntry, GetPublicUrlOptions, ListEntry, ListOptions, ObjectRecord, StorageBucketApi, StorageEngine, StorageResult, TransformOptions, UploadOptions, } from "./engines/storage.js";
export { InProcessRealtimeEngine, type RealtimeBroadcastCallback, type RealtimeChange, type RealtimeEngine, type RealtimeEvent, type RealtimePayload, type RealtimePostgresCallback, type RealtimePresenceCallback, } from "./engines/realtime.js";
export { LocalFunctionsRegistry, type FunctionHandler, type FunctionInvokeOptions, type FunctionInvokeResult, type FunctionRequest, type FunctionsEngine, type RpcResult, } from "./engines/functions.js";
export { StubAuthEngine, StubStorageEngine } from "./engines/stubs.js";
export { FakebaseKernel, type KernelOptions } from "./kernel.js";
//# sourceMappingURL=index.d.ts.map