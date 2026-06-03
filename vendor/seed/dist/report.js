/**
 * Honest generation: describe how every column *would* be resolved, without
 * generating data. Powers the CLI `--report` flag and runtime debugging so no
 * column is silently mis-generated — a fall-through to a raw type default is
 * visible, not hidden.
 */
import { createBuiltinProvider } from "./provider.js";
/**
 * Classify each column's generation strategy, mirroring the engine's
 * resolution priority order.
 */
export function describeResolution(schema, options = {}) {
    const provider = options.provider ?? createBuiltinProvider();
    const enumNames = new Set(schema.enums.map((e) => e.name));
    const out = [];
    for (const table of schema.tables) {
        for (const col of table.columns) {
            const hasOverride = options.overrides &&
                (options.overrides[`${table.schema}.${table.name}.${col.name}`] !==
                    undefined ||
                    options.overrides[`${table.name}.${col.name}`] !== undefined);
            let strategy;
            let detail;
            if (hasOverride) {
                strategy = "override";
            }
            else if (col.name === table.primaryKey || col.primaryKey) {
                strategy = "primary-key";
            }
            else if (col.generated || col.defaultSql !== undefined) {
                strategy = "skipped";
                detail = col.generated ? "generated" : `default ${col.defaultSql}`;
            }
            else if (col.references) {
                strategy = "foreign-key";
                detail = `→ ${col.references.table}.${col.references.column}`;
            }
            else if (enumNames.has(col.type)) {
                strategy = "enum";
                detail = col.type;
            }
            else if (provider.forName(col.name, col.type)) {
                strategy = "semantic";
            }
            else {
                strategy = "type";
                detail = col.type;
            }
            out.push({ table: table.name, column: col.name, strategy, detail });
        }
    }
    return out;
}
//# sourceMappingURL=report.js.map