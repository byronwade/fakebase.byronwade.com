"use client";

import * as React from "react";
import { useActionState } from "react";
import { Play } from "lucide-react";
import { runQueryAction, type ActionResult } from "@/app/playground/actions";
import { buildQueryCode, DEFAULT_SPEC, type QuerySpec } from "@/lib/playground/query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CallResult } from "@/components/playground/call-result";
import { cn } from "@/lib/utils";

export type SchemaTable = { name: string; columns: string[] };

const FIELD =
  "h-8 rounded-lg border border-border bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Editable `.from().select()…` builder. The user assembles a constrained spec;
 * the column dropdowns are driven off the selected table's real columns, and a
 * live `@supabase/supabase-js`-shaped preview updates as they edit. Submitting
 * runs it on the server kernel via `runQueryAction` and shows the real result.
 */
export function QueryConsole({
  tables,
  initialTable,
}: {
  tables: SchemaTable[];
  initialTable: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    runQueryAction,
    null,
  );

  const start = tables.some((t) => t.name === initialTable)
    ? initialTable
    : (tables[0]?.name ?? DEFAULT_SPEC.table);

  const [spec, setSpec] = React.useState<QuerySpec>({
    ...DEFAULT_SPEC,
    table: start,
    orderColumn: undefined,
    ascending: false,
  });

  const columns = tables.find((t) => t.name === spec.table)?.columns ?? [];
  const set = <K extends keyof QuerySpec>(key: K, value: QuerySpec[K]) =>
    setSpec((s) => ({ ...s, [key]: value }));

  // When the table changes, drop column selections that no longer exist.
  React.useEffect(() => {
    setSpec((s) => {
      const valid = new Set(columns);
      return {
        ...s,
        filterColumn: s.filterColumn && valid.has(s.filterColumn) ? s.filterColumn : undefined,
        orderColumn: s.orderColumn && valid.has(s.orderColumn) ? s.orderColumn : undefined,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.table]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <Label>from</Label>
            <select
              name="table"
              value={spec.table}
              onChange={(e) => set("table", e.target.value)}
              className={cn(FIELD, "font-mono")}
            >
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1">
            <Label>select</Label>
            <Input
              name="columns"
              value={spec.columns}
              onChange={(e) => set("columns", e.target.value)}
              placeholder="*"
              className="h-8 font-mono text-[13px]"
            />
          </label>

          <label className="flex w-20 flex-col gap-1">
            <Label>limit</Label>
            <Input
              name="limit"
              type="number"
              min={1}
              max={100}
              value={spec.limit ?? ""}
              onChange={(e) => set("limit", Number(e.target.value) || undefined)}
              className="h-8 font-mono text-[13px]"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <Label>where (eq)</Label>
            <select
              name="filterColumn"
              value={spec.filterColumn ?? ""}
              onChange={(e) => set("filterColumn", e.target.value || undefined)}
              className={cn(FIELD, "font-mono")}
            >
              <option value="">— none —</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 flex-col gap-1">
            <Label>equals</Label>
            <Input
              name="filterValue"
              value={spec.filterValue ?? ""}
              onChange={(e) => set("filterValue", e.target.value || undefined)}
              placeholder="value"
              disabled={!spec.filterColumn}
              className="h-8 font-mono text-[13px]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <Label>order by</Label>
            <select
              name="orderColumn"
              value={spec.orderColumn ?? ""}
              onChange={(e) => set("orderColumn", e.target.value || undefined)}
              className={cn(FIELD, "font-mono")}
            >
              <option value="">— none —</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <Label>direction</Label>
            <select
              name="ascending"
              value={spec.ascending ? "true" : "false"}
              onChange={(e) => set("ascending", e.target.value === "true")}
              disabled={!spec.orderColumn}
              className={FIELD}
            >
              <option value="false">desc</option>
              <option value="true">asc</option>
            </select>
          </label>

          <Button type="submit" disabled={pending} className="gap-1.5">
            <Play className="size-4" />
            {pending ? "Running…" : "Run"}
          </Button>
        </div>
      </form>

      <CallResult
        code={state?.code ?? buildQueryCode(spec)}
        result={state ? state.result : { data: "— press Run —", error: null }}
        ok={state ? state.ok : undefined}
      />
    </div>
  );
}
