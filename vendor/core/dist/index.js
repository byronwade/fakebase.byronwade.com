/**
 * @fakebase/core — public API surface.
 * Import from this entry point only; do not import sub-modules directly.
 */
// Errors
export { FakebaseError, FakebaseErrorCode, CapabilityError, toSupabaseError, } from "./errors.js";
// Capability registry
export { CapabilityStatus, CapabilityRegistry, } from "./capability.js";
// Schema registry
export { SchemaRegistry } from "./schema/registry.js";
// Query filter types and evaluator
export { applyFilter, parseOrString, } from "./query/filter.js";
// Query compiler
export { compileQuery } from "./query/compiler.js";
// Policy engine
export { PolicyEngine } from "./policy/engine.js";
// Event bus
export { EventBus } from "./events/bus.js";
// In-memory store helper
export { FakeStore } from "./store.js";
export { InProcessRealtimeEngine, } from "./engines/realtime.js";
export { LocalFunctionsRegistry, } from "./engines/functions.js";
export { StubAuthEngine, StubStorageEngine } from "./engines/stubs.js";
// Kernel
export { FakebaseKernel } from "./kernel.js";
//# sourceMappingURL=index.js.map