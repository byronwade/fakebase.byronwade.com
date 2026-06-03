/**
 * The high-level query plan produced by the client query builder and consumed
 * by `FakebaseKernel.query()`.
 *
 * This is intentionally distinct from the low-level adapter `QueryOptions`:
 * the plan models the *intent* of a Supabase-style fluent query (including
 * mutations and `negate`d filters), while the kernel translates it into the
 * concrete adapter operations and the {@link FilterNode} tree understood by
 * the query compiler.
 */
export {};
//# sourceMappingURL=plan.js.map