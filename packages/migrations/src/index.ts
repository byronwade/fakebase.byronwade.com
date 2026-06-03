// SQL export
export { exportSupabaseSql, exportSeedSql } from "./export-sql.js";
export type { ExportSqlOptions } from "./export-sql.js";

// Schema DSL helper
export { schema } from "./schema-parser.js";
export { parseTypescriptSchema, parseSqlSchema } from "./schema-parser.js";
export type {
  SchemaDef,
  TableDef,
  ColumnDef,
  EnumDef,
  ParsedSchemaSource,
} from "./schema-parser.js";

// Schema diff engine
export { diffSchemas, diffToSql, isSchemaDiffEmpty } from "./diff.js";
export type { SchemaDiff } from "./diff.js";

// Migration manager
export { MigrationManager } from "./migration-manager.js";
export type { MigrationRecord } from "./migration-manager.js";

// Snapshot manager
export { SnapshotManager } from "./snapshot.js";
export type { SnapshotManifest } from "./snapshot.js";
