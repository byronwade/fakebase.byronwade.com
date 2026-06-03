/**
 * @fakebase/core — public API surface.
 * Import from this entry point only; do not import sub-modules directly.
 */

// Errors
export {
  FakebaseError,
  FakebaseErrorCode,
  CapabilityError,
  toSupabaseError,
} from "./errors.js";

// Capability registry
export {
  CapabilityStatus,
  CapabilityRegistry,
  type CapabilityEntry,
} from "./capability.js";

// Schema IR types
export type {
  ColumnIR,
  ColumnType,
  EnumIR,
  FunctionIR,
  IndexIR,
  PolicyIR,
  ProjectSchemaIR,
  TableIR,
} from "./schema/ir.js";

// Schema registry
export { SchemaRegistry } from "./schema/registry.js";

// Query filter types and evaluator
export {
  applyFilter,
  parseOrString,
  type AndNode,
  type Filter,
  type FilterNode,
  type FilterOperator,
  type NotNode,
  type OrNode,
} from "./query/filter.js";

// Query compiler
export { compileQuery, type QueryOptions, type QueryResult } from "./query/compiler.js";

// High-level query plan (client builder ↔ kernel contract)
export type {
  AndFilter,
  FilterItem,
  KernelQueryResult,
  OrderItem,
  OrFilter,
  PlanFilterOperator,
  PlanOperation,
  QueryPlan,
  SimpleFilter,
} from "./query/plan.js";

// Policy engine
export { PolicyEngine, type RoleContext } from "./policy/engine.js";

// Event bus
export { EventBus, type EventHandler, type FakebaseEvent } from "./events/bus.js";

// Adapter interface
export {
  type AdapterRow,
  type AdapterTableState,
  type FakebaseAdapter,
} from "./adapter.js";

// In-memory store helper
export { FakeStore } from "./store.js";

// Engine contracts + canonical value types
export type {
  AuthAdminApi,
  AuthChangeEvent,
  AuthEngine,
  AuthResult,
  AuthSession,
  AuthUser,
  OtpRecord,
  SessionStorageAdapter,
} from "./engines/auth.js";
export type {
  BucketRecord,
  CreateBucketOptions,
  CreateSignedUrlOptions,
  FileObject,
  FolderEntry,
  GetPublicUrlOptions,
  ListEntry,
  ListOptions,
  ObjectRecord,
  StorageBucketApi,
  StorageEngine,
  StorageResult,
  TransformOptions,
  UploadOptions,
} from "./engines/storage.js";
export {
  InProcessRealtimeEngine,
  type RealtimeBroadcastCallback,
  type RealtimeChange,
  type RealtimeEngine,
  type RealtimeEvent,
  type RealtimePayload,
  type RealtimePostgresCallback,
  type RealtimePresenceCallback,
} from "./engines/realtime.js";
export {
  LocalFunctionsRegistry,
  type FunctionHandler,
  type FunctionInvokeOptions,
  type FunctionInvokeResult,
  type FunctionRequest,
  type FunctionsEngine,
  type RpcResult,
} from "./engines/functions.js";
export { StubAuthEngine, StubStorageEngine } from "./engines/stubs.js";

// Kernel
export { FakebaseKernel, type KernelOptions } from "./kernel.js";
