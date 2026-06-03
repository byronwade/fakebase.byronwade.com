"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from "lucide-react";

export interface Column<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  className?: string;
}

/** Read a property by an arbitrary string key without widening the row type. */
function cell<T extends object>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}

type SortDir = "asc" | "desc";

export function DataTable<T extends object>({
  columns,
  data,
  onRowClick,
  actions,
  emptyMessage = "No records found.",
  searchable = false,
  searchPlaceholder = "Search...",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const processed = useMemo(() => {
    let rows = [...data];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        columns.some((col) => {
          const val = row[col.key];
          return (
            val !== null && val !== undefined && String(val).toLowerCase().includes(q)
          );
        }),
      );
    }

    if (sortKey) {
      rows.sort((a, b) => {
        const av = cell(a, sortKey);
        const bv = cell(b, sortKey);
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, search, sortKey, sortDir, columns]);

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey)
      return <ChevronsUpDown className="h-3.5 w-3.5 text-gray-600" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3.5 w-3.5 text-blue-400" />
    ) : (
      <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-medium text-gray-400 whitespace-nowrap ${col.sortable ? "cursor-pointer select-none hover:text-white" : ""} ${col.className ?? ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && <SortIcon colKey={col.key} />}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-4 py-3 text-right font-medium text-gray-400 whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {processed.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-4 py-10 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              processed.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-gray-800/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 text-gray-300 font-mono text-xs ${col.className ?? ""}`}
                      onClick={(e) => actions && e.stopPropagation()}
                    >
                      {col.render ? (
                        col.render(row[col.key], row)
                      ) : row[col.key] === null || row[col.key] === undefined ? (
                        <span className="text-gray-600 italic">null</span>
                      ) : typeof row[col.key] === "object" ? (
                        JSON.stringify(row[col.key])
                      ) : (
                        String(row[col.key])
                      )}
                    </td>
                  ))}
                  {actions && (
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {actions(row)}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {processed.length > 0 && (
        <p className="text-xs text-gray-600 text-right">
          {processed.length} of {data.length} row{data.length !== 1 ? "s" : ""}
          {search ? ` (filtered)` : ""}
        </p>
      )}
    </div>
  );
}
