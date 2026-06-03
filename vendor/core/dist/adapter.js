/**
 * Adapter interface — the contract that every storage backend must fulfil.
 *
 * The kernel owns all higher-level semantics (defaults, RLS write checks,
 * event emission, plan translation). An adapter is responsible only for
 * persisting rows and answering the granular CRUD operations below.
 *
 * Read/mutation operations are async so that adapters backed by network or
 * file I/O can participate; `initialize` is synchronous so that a fully-usable
 * kernel can be created without `await` (see `createMemoryKernel`).
 */
export {};
//# sourceMappingURL=adapter.js.map