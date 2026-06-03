/**
 * Schema Intermediate Representation (IR).
 *
 * The IR is the canonical in-memory description of a Postgres schema as
 * understood by Fakebase. Adapters consume this to set up their storage;
 * the policy engine and query compiler reference it at query time.
 */

/** Native Postgres column types that Fakebase understands. */
export type ColumnType =
  | "text"
  | "varchar"
  | "int4"
  | "int8"
  | "float4"
  | "float8"
  | "bool"
  | "uuid"
  | "timestamptz"
  | "timestamp"
  | "date"
  | "jsonb"
  | "json"
  | "bytea"
  | "numeric"
  | string;

/** Describes a single column in a table. */
export interface ColumnIR {
  name: string;
  type: ColumnType;
  nullable: boolean;
  defaultSql?: string;
  primaryKey?: boolean;
  unique?: boolean;
  /** Foreign key reference. */
  references?: { table: string; column: string };
  /** True when the column value is database-generated (e.g. GENERATED ALWAYS AS IDENTITY). */
  generated?: boolean;
}

/** Describes an index on a table. */
export interface IndexIR {
  name: string;
  columns: string[];
  unique?: boolean;
}

/**
 * Describes a Postgres row-level security policy.
 * The `using` and `withCheck` fields are SQL expression strings that the
 * Fakebase policy engine will attempt to evaluate.
 */
export interface PolicyIR {
  name: string;
  table: string;
  schema: string;
  command: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
  roles: string[];
  /** USING expression (evaluated for SELECT / UPDATE / DELETE). */
  using?: string;
  /** WITH CHECK expression (evaluated for INSERT / UPDATE). */
  withCheck?: string;
  permissive: boolean;
}

/** Full description of a table, including its RLS configuration. */
export interface TableIR {
  schema: string;
  name: string;
  columns: ColumnIR[];
  indexes: IndexIR[];
  policies: PolicyIR[];
  rlsEnabled: boolean;
  primaryKey: string;
}

/** A Postgres enum type. */
export interface EnumIR {
  schema: string;
  name: string;
  values: string[];
}

/** A Postgres function / stored procedure. */
export interface FunctionIR {
  schema: string;
  name: string;
  args: { name: string; type: string }[];
  returnType: string;
  language?: string;
  body?: string;
}

/** The root IR object that represents a complete project schema. */
export interface ProjectSchemaIR {
  tables: TableIR[];
  enums: EnumIR[];
  functions: FunctionIR[];
  /** Schema version, bumped on every migration. */
  version: number;
}
