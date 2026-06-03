/**
 * Query compiler — applies filters, ordering, pagination, and projection
 * to an in-memory row array and returns a Supabase-shaped result envelope.
 */

import { FakebaseError, FakebaseErrorCode } from "../errors.js";
import { applyFilter, type Filter } from "./filter.js";

/** Configuration for a compiled query. */
export interface QueryOptions {
  table: string;
  schema: string;
  /** Column names to include in output (undefined = all columns). */
  select?: string[];
  filters: Filter[];
  orderBy?: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  limit?: number;
  offset?: number;
  count?: "exact" | "planned" | "estimated";
}

/** Standard result envelope returned by all adapter operations. */
export interface QueryResult<T> {
  data: T[] | null;
  error: FakebaseError | null;
  count: number | null;
  status: number;
  statusText: string;
}

/** Project a row to only the requested columns. */
function projectRow<T extends Record<string, unknown>>(
  row: T,
  columns: string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    out[col] = row[col];
  }
  return out;
}

/** Compare two row values for ordering, respecting nulls placement. */
function compareValues(
  a: unknown,
  b: unknown,
  ascending: boolean,
  nullsFirst: boolean,
): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;

  if (aNull && bNull) return 0;
  if (aNull) return nullsFirst ? -1 : 1;
  if (bNull) return nullsFirst ? 1 : -1;

  let cmp = 0;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else {
    cmp = String(a).localeCompare(String(b));
  }
  return ascending ? cmp : -cmp;
}

/** Build an error result envelope from any thrown value. */
function errorResult<T>(err: unknown): QueryResult<T> {
  const fbErr =
    err instanceof FakebaseError
      ? err
      : new FakebaseError(
          FakebaseErrorCode.ADAPTER_ERROR,
          err instanceof Error ? err.message : String(err),
        );
  return {
    data: null,
    error: fbErr,
    count: null,
    status: fbErr.status,
    statusText: fbErr.message,
  };
}

/**
 * Apply all query options to an array of rows and return the Supabase-shaped
 * result envelope. This is the core "execution engine" for all in-memory
 * adapters.
 */
export function compileQuery<T extends Record<string, unknown>>(
  options: QueryOptions,
  rows: T[],
): QueryResult<T> {
  try {
    // Apply filters
    let filtered: T[] = rows;
    if (options.filters.length > 0) {
      filtered = rows.filter((row) =>
        options.filters.every((f) => applyFilter(row as Record<string, unknown>, f)),
      );
    }

    // Record count before pagination
    const totalCount = filtered.length;

    // Apply ordering
    if (options.orderBy && options.orderBy.length > 0) {
      const orderings = options.orderBy;
      filtered = [...filtered].sort((a, b) => {
        for (const ord of orderings) {
          const diff = compareValues(
            a[ord.column],
            b[ord.column],
            ord.ascending,
            ord.nullsFirst ?? false,
          );
          if (diff !== 0) return diff;
        }
        return 0;
      });
    }

    // Apply offset
    if (options.offset != null && options.offset > 0) {
      filtered = filtered.slice(options.offset);
    }

    // Apply limit
    if (options.limit != null) {
      filtered = filtered.slice(0, options.limit);
    }

    // Project columns
    let data: T[];
    if (options.select && options.select.length > 0) {
      data = filtered.map((row) => projectRow(row, options.select as string[]) as T);
    } else {
      data = filtered;
    }

    const count = options.count != null ? totalCount : null;

    return {
      data,
      error: null,
      count,
      status: 200,
      statusText: "OK",
    };
  } catch (err) {
    return errorResult<T>(err);
  }
}
