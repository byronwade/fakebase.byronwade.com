import type { ColumnType } from "@byronwade/core";

/** Map an IR ColumnType to its canonical Postgres SQL type name. */
export function mapIrTypeToSql(colType: ColumnType): string {
  switch (colType) {
    case "uuid":
      return "uuid";
    case "text":
      return "text";
    case "varchar":
      return "varchar";
    case "char":
      return "char";
    case "int4":
      return "integer";
    case "int8":
      return "bigint";
    case "float4":
      return "real";
    case "float8":
      return "double precision";
    case "bool":
      return "boolean";
    case "timestamptz":
      return "timestamptz";
    case "timestamp":
      return "timestamp";
    case "date":
      return "date";
    case "time":
      return "time";
    case "jsonb":
      return "jsonb";
    case "json":
      return "json";
    case "bytea":
      return "bytea";
    case "numeric":
      return "numeric";
    case "serial":
      return "serial";
    default:
      return colType;
  }
}
