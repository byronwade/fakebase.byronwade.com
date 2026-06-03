/**
 * Maps Fakebase schema IR column types to SQLite column affinities,
 * and handles value serialization / deserialization for storage.
 */

const JSON_TYPES = new Set(["jsonb", "json"]);
const BOOL_TYPES = new Set(["bool"]);
const INT_TYPES = new Set(["int4", "int8"]);
const REAL_TYPES = new Set(["float4", "float8", "numeric"]);

/** Map an IR column type to a SQLite column affinity keyword. */
export function mapColumnType(irType: string): string {
  switch (irType) {
    case "uuid":
    case "text":
    case "varchar":
    case "timestamptz":
    case "timestamp":
    case "date":
    case "jsonb":
    case "json":
      return "TEXT";
    case "int4":
    case "int8":
    case "bool":
      return "INTEGER";
    case "float4":
    case "float8":
    case "numeric":
      return "REAL";
    case "bytea":
      return "BLOB";
    default:
      return "TEXT";
  }
}

/** Serialize a value for storage in SQLite. */
export function serializeValue(value: unknown, irType: string): unknown {
  if (value === null || value === undefined) return null;
  if (JSON_TYPES.has(irType)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  if (BOOL_TYPES.has(irType)) {
    return value ? 1 : 0;
  }
  return value;
}

/** Deserialize a value retrieved from SQLite back to its JS form. */
export function deserializeValue(value: unknown, irType: string): unknown {
  if (value === null || value === undefined) return null;
  if (JSON_TYPES.has(irType)) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (BOOL_TYPES.has(irType)) {
    return value === 1 || value === true;
  }
  if (INT_TYPES.has(irType)) {
    return typeof value === "number" ? value : parseInt(String(value), 10);
  }
  if (REAL_TYPES.has(irType)) {
    return typeof value === "number" ? value : parseFloat(String(value));
  }
  return value;
}
