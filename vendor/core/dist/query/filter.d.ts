/**
 * Query filter types and row-level evaluators.
 *
 * Implements the full PostgREST operator set so that callers can use the same
 * filter expressions regardless of the underlying storage adapter.
 */
/** All supported PostgREST filter operators. */
export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in" | "contains" | "containedBy" | "overlaps" | "rangeGt" | "rangeGte" | "rangeLt" | "rangeLte" | "rangeAdjacent" | "match" | "not";
/** A leaf predicate applied to a single column. */
export interface FilterNode {
    column: string;
    operator: FilterOperator;
    value: unknown;
}
/** A disjunction of filters. */
export interface OrNode {
    type: "or";
    filters: Filter[];
}
/** A conjunction of filters. */
export interface AndNode {
    type: "and";
    filters: Filter[];
}
/** Logical negation of a single child filter. */
export interface NotNode {
    type: "not";
    filter: Filter;
}
/** Any node in a low-level filter tree understood by {@link applyFilter}. */
export type Filter = FilterNode | OrNode | AndNode | NotNode;
/**
 * Apply a filter tree to a single row.
 * Returns true when the row passes all predicates.
 */
export declare function applyFilter(row: Record<string, unknown>, filter: Filter): boolean;
/**
 * Parse a PostgREST `.or()` string such as `"name.eq.alice,age.gt.18"` into an
 * `OrNode`. Comma-delimited items are treated as OR branches; each item is
 * `column.operator.value`.
 */
export declare function parseOrString(str: string): OrNode;
//# sourceMappingURL=filter.d.ts.map