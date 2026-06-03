/**
 * Maps Fakebase schema IR column types to PGlite (Postgres) column types,
 * and handles value serialization / deserialization across the WASM boundary.
 *
 * `uuid` and temporal types are stored as `text` so the adapter accepts the
 * same lenient values as the other adapters (e.g. non-UUID string ids and
 * verbatim ISO timestamps), keeping behaviour identical across the contract
 * suite. `jsonb` and `boolean` use their native Postgres types.
 */

const JSON_TYPES = new Set(["jsonb", "json"]);
const INT_TYPES = new Set(["int4", "int8", "serial", "bigserial"]);
const REAL_TYPES = new Set(["float4", "float8", "numeric", "decimal"]);

/** Map an IR column type to a Postgres column type. */
export function mapColumnType(irType: string): string {
  switch (irType) {
    case "uuid":
    case "text":
    case "varchar":
    case "timestamptz":
    case "timestamp":
    case "date":
      return "text";
    case "jsonb":
      return "jsonb";
    case "json":
      return "json";
    case "int4":
    case "serial":
      return "integer";
    case "int8":
    case "bigserial":
      return "bigint";
    case "bool":
      return "boolean";
    case "float4":
      return "real";
    case "float8":
      return "double precision";
    case "numeric":
    case "decimal":
      return "numeric";
    case "bytea":
      return "bytea";
    default:
      return "text";
  }
}

/** Serialize a value for binding into a PGlite parameterized query. */
export function serializeValue(value: unknown, irType: string): unknown {
  if (value === null || value === undefined) return null;
  if (JSON_TYPES.has(irType)) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

/** Deserialize a value returned by PGlite back to its JS form. */
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
  if (INT_TYPES.has(irType)) {
    return typeof value === "number" ? value : parseInt(String(value), 10);
  }
  if (REAL_TYPES.has(irType)) {
    return typeof value === "number" ? value : parseFloat(String(value));
  }
  return value;
}
