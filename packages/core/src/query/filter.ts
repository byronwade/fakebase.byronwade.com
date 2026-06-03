/**
 * Query filter types and row-level evaluators.
 *
 * Implements the full PostgREST operator set so that callers can use the same
 * filter expressions regardless of the underlying storage adapter.
 */

/** All supported PostgREST filter operators. */
export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "in"
  | "contains"
  | "containedBy"
  | "overlaps"
  | "rangeGt"
  | "rangeGte"
  | "rangeLt"
  | "rangeLte"
  | "rangeAdjacent"
  | "match"
  | "not";

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

/** Convert a glob-style LIKE pattern to a RegExp. */
function likeToRegex(pattern: string, caseInsensitive: boolean): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, caseInsensitive ? "i" : "");
}

/** Parse a PostgREST range literal `"[lower,upper)"` into its bounds. */
function parseRange(val: unknown): {
  lower: number;
  upper: number;
  lowerInclusive: boolean;
  upperInclusive: boolean;
} | null {
  if (typeof val !== "string") return null;
  const m = val.match(/^([\[(])(-?[\d.]+),(-?[\d.]+)([\])])$/);
  if (!m) return null;
  return {
    lowerInclusive: m[1] === "[",
    lower: parseFloat(m[2] ?? "0"),
    upper: parseFloat(m[3] ?? "0"),
    upperInclusive: m[4] === "]",
  };
}

/** Evaluate a leaf FilterNode against a single row. */
function applyLeaf(row: Record<string, unknown>, filter: FilterNode): boolean {
  const col = row[filter.column];
  const val = filter.value;

  switch (filter.operator) {
    case "eq":
      return col === val;

    case "neq":
      return col !== val;

    case "gt":
      return typeof col === "number" && typeof val === "number"
        ? col > val
        : String(col) > String(val);

    case "gte":
      return typeof col === "number" && typeof val === "number"
        ? col >= val
        : String(col) >= String(val);

    case "lt":
      return typeof col === "number" && typeof val === "number"
        ? col < val
        : String(col) < String(val);

    case "lte":
      return typeof col === "number" && typeof val === "number"
        ? col <= val
        : String(col) <= String(val);

    case "like":
      return typeof col === "string" && typeof val === "string"
        ? likeToRegex(val, false).test(col)
        : false;

    case "ilike":
      return typeof col === "string" && typeof val === "string"
        ? likeToRegex(val, true).test(col)
        : false;

    case "is":
      // Handles IS NULL, IS NOT NULL, IS TRUE, IS FALSE
      if (val === null || val === "null") return col === null || col === undefined;
      if (val === true || val === "true") return col === true;
      if (val === false || val === "false") return col === false;
      return col === val;

    case "in": {
      const arr = Array.isArray(val)
        ? val
        : typeof val === "string"
          ? val.split(",").map((s) => s.trim())
          : [val];
      return arr.includes(col);
    }

    case "contains": {
      // jsonb @> operator: column contains all key-value pairs in val
      if (typeof col !== "object" || col === null) return false;
      if (Array.isArray(col) && Array.isArray(val)) {
        return (val as unknown[]).every((v) => (col as unknown[]).includes(v));
      }
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        return Object.entries(val as Record<string, unknown>).every(
          ([k, v]) => (col as Record<string, unknown>)[k] === v,
        );
      }
      return false;
    }

    case "containedBy": {
      // jsonb <@ operator: all column values exist in val
      if (Array.isArray(col) && Array.isArray(val)) {
        return (col as unknown[]).every((v) => (val as unknown[]).includes(v));
      }
      return false;
    }

    case "overlaps": {
      // && operator: arrays share at least one element
      if (Array.isArray(col) && Array.isArray(val)) {
        return (col as unknown[]).some((v) => (val as unknown[]).includes(v));
      }
      return false;
    }

    case "rangeGt": {
      const range = parseRange(col);
      const cmp = typeof val === "number" ? val : parseFloat(String(val));
      if (!range) return false;
      return range.lower > cmp || (range.lowerInclusive && range.lower >= cmp);
    }

    case "rangeGte": {
      const range = parseRange(col);
      const cmp = typeof val === "number" ? val : parseFloat(String(val));
      if (!range) return false;
      return range.lower >= cmp;
    }

    case "rangeLt": {
      const range = parseRange(col);
      const cmp = typeof val === "number" ? val : parseFloat(String(val));
      if (!range) return false;
      return range.upper < cmp || (!range.upperInclusive && range.upper <= cmp);
    }

    case "rangeLte": {
      const range = parseRange(col);
      const cmp = typeof val === "number" ? val : parseFloat(String(val));
      if (!range) return false;
      return range.upper <= cmp;
    }

    case "rangeAdjacent": {
      // -|- operator: two ranges are adjacent (share a boundary)
      const a = parseRange(col);
      const b = parseRange(val);
      if (!a || !b) return false;
      return a.upper === b.lower || a.lower === b.upper;
    }

    case "match": {
      // Full-text search: row column matches the tsquery represented by val
      if (typeof col !== "string" || typeof val !== "string") return false;
      return col.toLowerCase().includes(val.toLowerCase());
    }

    case "not": {
      // Negate the inner filter stored in value
      if (typeof val === "object" && val !== null && "operator" in val) {
        return !applyLeaf(row, {
          column: filter.column,
          ...(val as Omit<FilterNode, "column">),
        });
      }
      return col !== val;
    }

    default:
      return false;
  }
}

/**
 * Apply a filter tree to a single row.
 * Returns true when the row passes all predicates.
 */
export function applyFilter(row: Record<string, unknown>, filter: Filter): boolean {
  if ("type" in filter) {
    if (filter.type === "or") {
      return filter.filters.some((f) => applyFilter(row, f));
    }
    if (filter.type === "and") {
      return filter.filters.every((f) => applyFilter(row, f));
    }
    if (filter.type === "not") {
      return !applyFilter(row, filter.filter);
    }
  }
  return applyLeaf(row, filter as FilterNode);
}

/**
 * Parse a PostgREST `.or()` string such as `"name.eq.alice,age.gt.18"` into an
 * `OrNode`. Comma-delimited items are treated as OR branches; each item is
 * `column.operator.value`.
 */
export function parseOrString(str: string): OrNode {
  const filters: FilterNode[] = str.split(",").map((part) => {
    const dotIdx = part.indexOf(".");
    const rest = part.slice(dotIdx + 1);
    const opIdx = rest.indexOf(".");
    const column = part.slice(0, dotIdx);
    const operator = rest.slice(0, opIdx) as FilterOperator;
    const rawValue = rest.slice(opIdx + 1);

    let value: unknown = rawValue;
    if (rawValue === "null") value = null;
    else if (rawValue === "true") value = true;
    else if (rawValue === "false") value = false;
    else if (!isNaN(Number(rawValue)) && rawValue !== "") value = Number(rawValue);

    return { column, operator, value };
  });

  return { type: "or", filters };
}
