import type {
  ProjectSchemaIR,
  TableIR,
  ColumnIR,
  ColumnType,
  IndexIR,
  PolicyIR,
  EnumIR,
  FunctionIR,
} from "@fakebase/core";

// ---------------------------------------------------------------------------
// Schema DSL types
// ---------------------------------------------------------------------------

export interface ColumnDef {
  type: ColumnType;
  nullable?: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  /** SQL default expression e.g. `gen_random_uuid()` or `now()`. */
  default?: string;
  references?: { table: string; column: string };
  generated?: boolean;
}

export interface TableDef {
  columns: Record<string, ColumnDef>;
  schema?: string;
  rls?: boolean;
  indexes?: IndexIR[];
  policies?: PolicyIR[];
}

export interface EnumDef {
  values: string[];
}

export interface SchemaDef {
  version?: number;
  tables?: Record<string, TableDef>;
  enums?: Record<string, EnumDef>;
  functions?: FunctionIR[];
}

export interface ParsedSchemaSource {
  type: "typescript" | "sql";
  content: string;
  path?: string;
}

// ---------------------------------------------------------------------------
// DSL helper — schema()
// ---------------------------------------------------------------------------

/**
 * Schema DSL helper.
 *
 * Converts a plain JavaScript/TypeScript schema definition object into a full
 * `ProjectSchemaIR`, validating column types and resolving defaults.
 *
 * Usage in a schema definition file:
 * ```ts
 * import { schema } from "@fakebase/migrations";
 * export default schema({ tables: { ... }, enums: { ... } });
 * ```
 */
export function schema(def: SchemaDef): ProjectSchemaIR {
  const tables: TableIR[] = [];

  for (const [tableName, tableDef] of Object.entries(def.tables ?? {})) {
    const columns: ColumnIR[] = [];
    let primaryKey = "id";

    for (const [colName, colDef] of Object.entries(tableDef.columns)) {
      const col: ColumnIR = {
        name: colName,
        type: colDef.type,
        nullable: colDef.nullable !== false && !colDef.primaryKey,
      };

      if (colDef.primaryKey) {
        col.primaryKey = true;
        col.nullable = false;
        primaryKey = colName;
      }
      if (colDef.unique) col.unique = true;
      if (colDef.default) col.defaultSql = colDef.default;
      if (colDef.references) col.references = colDef.references;
      if (colDef.generated) col.generated = true;

      columns.push(col);
    }

    tables.push({
      schema: tableDef.schema ?? "public",
      name: tableName,
      columns,
      indexes: tableDef.indexes ?? [],
      policies: tableDef.policies ?? [],
      rlsEnabled: tableDef.rls ?? false,
      primaryKey,
    });
  }

  const enums: EnumIR[] = [];
  for (const [enumName, enumDef] of Object.entries(def.enums ?? {})) {
    enums.push({ schema: "public", name: enumName, values: enumDef.values });
  }

  return {
    version: def.version ?? 1,
    tables,
    enums,
    functions: def.functions ?? [],
  };
}

// ---------------------------------------------------------------------------
// TypeScript source parser
// ---------------------------------------------------------------------------

/**
 * Parse a TypeScript schema definition source file into a `ProjectSchemaIR`.
 *
 * The source must export a default `schema({...})` call using the Fakebase DSL.
 * Import statements are stripped before evaluation so the DSL is self-contained.
 *
 * @example
 * ```ts
 * const ir = parseTypescriptSchema(`
 *   import { schema } from "@fakebase/migrations";
 *   export default schema({
 *     tables: {
 *       users: { columns: { id: { type: "uuid", primaryKey: true } } },
 *     },
 *     enums: {},
 *   });
 * `);
 * ```
 */
export function parseTypescriptSchema(source: string): ProjectSchemaIR {
  // Strip import statements
  let cleaned = source.replace(/^import\s[^;]+;?\s*$/gm, "").trimStart();

  // Rewrite `export default schema(` to `return schema(`
  cleaned = cleaned.replace(/export\s+default\s+schema\s*\(/, "return schema(");

  // Also handle `export default` for any other form
  cleaned = cleaned.replace(/export\s+default\s+/, "return ");

  try {
    const result = new Function("schema", cleaned)(schema) as unknown;
    if (
      result !== null &&
      typeof result === "object" &&
      "tables" in result &&
      "enums" in result
    ) {
      return result as ProjectSchemaIR;
    }
    throw new Error("Schema function did not return a valid ProjectSchemaIR");
  } catch (err) {
    throw new Error(
      `Failed to parse TypeScript schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// SQL parser helpers
// ---------------------------------------------------------------------------

/** Normalize a raw SQL type token to a canonical IR ColumnType. */
function normalizeType(raw: string): ColumnType {
  const t = raw.trim().toLowerCase();
  if (t.startsWith("character varying") || t.startsWith("varchar")) return "varchar";
  if (t === "integer" || t === "int" || t === "int4") return "int4";
  if (t === "bigint" || t === "int8") return "int8";
  if (t === "real" || t === "float4") return "float4";
  if (t === "double precision" || t === "float8") return "float8";
  if (t === "boolean" || t === "bool") return "bool";
  if (t === "uuid") return "uuid";
  if (t === "text") return "text";
  if (t === "timestamptz" || t === "timestamp with time zone") return "timestamptz";
  if (t === "timestamp" || t === "timestamp without time zone") return "timestamp";
  if (t === "date") return "date";
  if (t === "time") return "time";
  if (t === "jsonb") return "jsonb";
  if (t === "json") return "json";
  if (t === "bytea") return "bytea";
  if (t === "numeric" || t === "decimal") return "numeric";
  if (t === "serial") return "serial";
  return t as ColumnType;
}

/** Split the column list body of a CREATE TABLE into individual definition strings. */
function splitColumnDefs(body: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of body) {
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.trim()) result.push(current.trim());
  return result;
}

/**
 * Parse SQL DDL (CREATE TABLE statements) into a partial `ProjectSchemaIR`.
 *
 * Handles: column names+types, NOT NULL, PRIMARY KEY, DEFAULT, UNIQUE,
 * REFERENCES, inline FOREIGN KEY constraints, CREATE INDEX.
 */
export function parseSqlSchema(sql: string): Partial<ProjectSchemaIR> {
  const tables: TableIR[] = [];

  // Match CREATE TABLE blocks
  const createTableRe =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([\s\S]*?)\)\s*;/gi;

  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = createTableRe.exec(sql)) !== null) {
    const schemaName = tableMatch[1] ?? "public";
    const tableName = tableMatch[2]!;
    const body = tableMatch[3]!;

    const columns: ColumnIR[] = [];
    const pkSet = new Set<string>();
    const fkMap = new Map<string, { table: string; column: string }>();

    for (const def of splitColumnDefs(body)) {
      const trimmed = def.trim();
      if (!trimmed) continue;

      // Table-level PRIMARY KEY constraint
      const pkConstraint = trimmed.match(
        /^(?:constraint\s+\w+\s+)?primary\s+key\s*\(([^)]+)\)/i,
      );
      if (pkConstraint) {
        pkConstraint[1]!
          .split(",")
          .forEach((c) => pkSet.add(c.trim().replace(/"/g, "")));
        continue;
      }

      // Table-level FOREIGN KEY constraint
      const fkConstraint = trimmed.match(
        /^(?:constraint\s+\w+\s+)?foreign\s+key\s*\(([^)]+)\)\s+references\s+(?:"?\w+"?\.)?"?(\w+)"?\s*\(([^)]+)\)/i,
      );
      if (fkConstraint) {
        const cols = fkConstraint[1]!.split(",").map((c) => c.trim().replace(/"/g, ""));
        const refTable = fkConstraint[2]!;
        const refCols = fkConstraint[3]!
          .split(",")
          .map((c) => c.trim().replace(/"/g, ""));
        cols.forEach((col, i) =>
          fkMap.set(col, { table: refTable, column: refCols[i] ?? refCols[0]! }),
        );
        continue;
      }

      // Skip CHECK / UNIQUE table constraints
      if (/^(?:constraint\s+\w+\s+)?(?:check|unique)\s*\(/i.test(trimmed)) {
        continue;
      }

      // Column definition — match: "name" <type> [options...]
      const colMatch = trimmed.match(/^"?(\w+)"?\s+([\s\S]+)$/);
      if (!colMatch) continue;

      const colName = colMatch[1]!;
      const afterName = colMatch[2]!;

      // The type is everything up to the first column-option keyword.
      const typeStop = afterName.search(
        /\s+(?:not\s+null|null|primary|unique|default|references|check|generated)/i,
      );
      const rawType = (
        typeStop !== -1 ? afterName.slice(0, typeStop) : afterName
      ).trim();

      const rest = typeStop !== -1 ? afterName.slice(typeStop) : "";

      const notNull = /\bnot\s+null\b/i.test(rest);
      const isPk = /\bprimary\s+key\b/i.test(rest);
      const isUnique = /\bunique\b/i.test(rest);
      const defaultMatch = rest.match(/\bdefault\s+([^\s,]+(?:\([^)]*\))?)/i);
      const referencesMatch = rest.match(
        /\breferences\s+(?:"?\w+"?\.)?"?(\w+)"?\s*\("?(\w+)"?\)/i,
      );

      const col: ColumnIR = {
        name: colName,
        type: normalizeType(rawType),
        nullable: !notNull && !isPk,
      };

      if (isPk) {
        col.primaryKey = true;
        col.nullable = false;
        pkSet.add(colName);
      }
      if (isUnique) col.unique = true;
      if (defaultMatch) col.defaultSql = defaultMatch[1];
      if (referencesMatch) {
        col.references = {
          table: referencesMatch[1]!,
          column: referencesMatch[2]!,
        };
      }

      columns.push(col);
    }

    // Apply table-level FK constraints
    for (const col of columns) {
      const fk = fkMap.get(col.name);
      if (fk) col.references = fk;
    }

    // Apply table-level PRIMARY KEY constraints
    for (const col of columns) {
      if (pkSet.has(col.name)) {
        col.primaryKey = true;
        col.nullable = false;
      }
    }

    const primaryKey = [...pkSet][0] ?? columns.find((c) => c.primaryKey)?.name ?? "id";

    tables.push({
      schema: schemaName,
      name: tableName,
      columns,
      indexes: [],
      policies: [],
      rlsEnabled: false,
      primaryKey,
    });
  }

  // Parse CREATE INDEX statements
  const createIndexRe =
    /create\s+(unique\s+)?index\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?\s+on\s+(?:"?\w+"?\.)?"?(\w+)"?\s*\(([^)]+)\)/gi;

  let idxMatch: RegExpExecArray | null;
  while ((idxMatch = createIndexRe.exec(sql)) !== null) {
    const isUnique = !!idxMatch[1];
    const idxName = idxMatch[2]!;
    const tableName = idxMatch[3]!;
    const cols = idxMatch[4]!.split(",").map((c) => c.trim().replace(/"/g, ""));

    const table = tables.find((t) => t.name === tableName);
    if (table) {
      table.indexes.push({ name: idxName, columns: cols, unique: isUnique });
    }
  }

  // CREATE TYPE <name> AS ENUM ('a', 'b', ...)
  const enums: EnumIR[] = [];
  const createEnumRe =
    /create\s+type\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s+as\s+enum\s*\(([^)]*)\)\s*;/gi;
  let enumMatch: RegExpExecArray | null;
  while ((enumMatch = createEnumRe.exec(sql)) !== null) {
    const schemaName = enumMatch[1] ?? "public";
    const enumName = enumMatch[2]!;
    const values = enumMatch[3]!
      .split(",")
      .map((v) => v.trim().replace(/^'|'$/g, "").replace(/''/g, "'"))
      .filter((v) => v.length > 0);
    enums.push({ schema: schemaName, name: enumName, values });
  }

  return { tables, enums, functions: [] };
}
