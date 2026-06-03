"use client";

import Link from "next/link";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type TableMeta = { name: string; columnCount: number; rowHint?: number };

/**
 * Left rail of the playground studio — the schema's tables. Selecting one drives
 * the `?table=` search param, which the page re-reads server-side to load that
 * table's rows into the Browse panel.
 */
export function TableSidebar({
  tables,
  activeTable,
}: {
  tables: TableMeta[];
  activeTable: string;
}) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Tables">
      <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        public schema
      </div>
      {tables.map((t) => {
        const active = t.name === activeTable;
        return (
          <Link
            key={t.name}
            href={`/playground?table=${t.name}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Table2
              className={cn(
                "size-4 shrink-0",
                active ? "text-brand" : "text-muted-foreground/70",
              )}
            />
            <span className="flex-1 truncate font-mono text-[13px]">{t.name}</span>
            <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground/70">
              {t.columnCount}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
