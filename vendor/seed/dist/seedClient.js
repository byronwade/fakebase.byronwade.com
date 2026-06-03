/**
 * Runtime entry point: generate rows and insert them through a Supabase-shaped
 * client, in foreign-key-safe order. Idempotent — tables that already contain
 * rows are skipped, so it is safe to call on every boot.
 */
import { generateRows } from "./generate.js";
import { orderTables } from "./order.js";
export async function seedClient(client, schema, options = {}) {
    const generated = generateRows(schema, options);
    const inserted = {};
    const skipped = [];
    // Insert in FK order so parents exist before children reference them.
    for (const table of orderTables(schema)) {
        const rows = generated[`${table.schema}.${table.name}`] ?? [];
        if (rows.length === 0)
            continue;
        const query = table.schema === "public"
            ? client.from(table.name)
            : client.schema(table.schema).from(table.name);
        if (!options.force) {
            const existing = await query.select("*").limit(1);
            if (existing.error)
                throw existing.error;
            if ((existing.data?.length ?? 0) > 0) {
                skipped.push(table.name);
                continue;
            }
        }
        const insertQuery = table.schema === "public"
            ? client.from(table.name)
            : client.schema(table.schema).from(table.name);
        const { error } = await insertQuery.insert(rows);
        if (error)
            throw error;
        inserted[table.name] = rows.length;
    }
    return { inserted, skipped };
}
//# sourceMappingURL=seedClient.js.map