"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Upload,
  Download,
  ChevronDown,
  Filter,
  X,
  Edit2,
  Check,
} from "lucide-react";
import { DataTable } from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

// ---------------------------------------------------------------------------
// Demo fixture data
// ---------------------------------------------------------------------------

const DEMO_TABLES = {
  users: {
    columns: ["id", "email", "role", "created_at", "email_confirmed"],
    rows: [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        email: "alice@example.com",
        role: "admin",
        created_at: "2024-01-01T10:00:00Z",
        email_confirmed: true,
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "bob@example.com",
        role: "user",
        created_at: "2024-01-02T11:30:00Z",
        email_confirmed: true,
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        email: "carol@example.com",
        role: "user",
        created_at: "2024-01-03T09:15:00Z",
        email_confirmed: false,
      },
    ],
  },
  posts: {
    columns: ["id", "title", "author_id", "published", "created_at"],
    rows: [
      {
        id: "a1b2c3d4-0001-0000-0000-000000000000",
        title: "Hello World",
        author_id: "550e8400-e29b-41d4-a716-446655440000",
        published: true,
        created_at: "2024-01-10T08:00:00Z",
      },
      {
        id: "a1b2c3d4-0002-0000-0000-000000000000",
        title: "Getting Started",
        author_id: "550e8400-e29b-41d4-a716-446655440001",
        published: false,
        created_at: "2024-01-11T14:22:00Z",
      },
    ],
  },
  comments: {
    columns: ["id", "post_id", "author_id", "body", "created_at"],
    rows: [
      {
        id: "c0000001-0000-0000-0000-000000000000",
        post_id: "a1b2c3d4-0001-0000-0000-000000000000",
        author_id: "550e8400-e29b-41d4-a716-446655440001",
        body: "Great post!",
        created_at: "2024-01-12T10:00:00Z",
      },
    ],
  },
} as const;

type TableName = keyof typeof DEMO_TABLES;
type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface ActiveFilter {
  column: string;
  value: string;
}

function FilterBar({
  columns,
  filter,
  onChange,
  onClear,
}: {
  columns: string[];
  filter: ActiveFilter | null;
  onChange: (f: ActiveFilter) => void;
  onClear: () => void;
}) {
  const [col, setCol] = useState(columns[0] ?? "");
  const [val, setVal] = useState("");

  function apply() {
    if (col && val.trim()) onChange({ column: col, value: val.trim() });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
      <select
        value={col}
        onChange={(e) => setCol(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
      >
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span className="text-gray-500 text-sm">=</span>
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder="value..."
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-40"
      />
      <button
        onClick={apply}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        Apply
      </button>
      {filter && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
      {filter && (
        <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-1 rounded">
          {filter.column} = &quot;{filter.value}&quot;
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add/Edit row modal
// ---------------------------------------------------------------------------

function RowModal({
  open,
  onClose,
  columns,
  initialValues,
  onSave,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  columns: string[];
  initialValues: Row;
  onSave: (row: Row) => void;
  mode: "add" | "edit";
}) {
  const [values, setValues] = useState<Row>(initialValues);

  function handleSave() {
    onSave(values);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "add" ? "Add Row" : "Edit Row"}
      size="md"
    >
      <div className="space-y-4">
        {columns.map((col) => (
          <div key={col}>
            <label className="block text-xs font-medium text-gray-400 mb-1 font-mono">
              {col}
            </label>
            <input
              type="text"
              value={
                values[col] !== undefined && values[col] !== null
                  ? String(values[col])
                  : ""
              }
              onChange={(e) => setValues((v) => ({ ...v, [col]: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              placeholder={`Enter ${col}...`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          {mode === "add" ? "Add Row" : "Save Changes"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DataPage() {
  const [selectedTable, setSelectedTable] = useState<TableName>("users");
  const [tableData, setTableData] = useState<Record<string, Row[]>>(() =>
    Object.fromEntries(
      Object.entries(DEMO_TABLES).map(([k, v]) => [k, v.rows.map((r) => ({ ...r }))]),
    ),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<{ column: string; value: string } | null>(null);

  const currentColumns = DEMO_TABLES[selectedTable].columns as unknown as string[];
  const rows = tableData[selectedTable] ?? [];

  const filteredRows = useMemo(() => {
    if (!filter) return rows;
    return rows.filter((r) =>
      String(r[filter.column] ?? "")
        .toLowerCase()
        .includes(filter.value.toLowerCase()),
    );
  }, [rows, filter]);

  function handleAddRow(newRow: Row) {
    setTableData((d) => ({
      ...d,
      [selectedTable]: [...(d[selectedTable] ?? []), newRow],
    }));
  }

  function handleEditRow(updated: Row) {
    if (editIndex === null) return;
    setTableData((d) => {
      const updated2 = [...(d[selectedTable] ?? [])];
      updated2[editIndex] = updated;
      return { ...d, [selectedTable]: updated2 };
    });
  }

  function handleDeleteRow(idx: number) {
    setTableData((d) => ({
      ...d,
      [selectedTable]: (d[selectedTable] ?? []).filter((_, i) => i !== idx),
    }));
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTable}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: unknown = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed)) {
          setTableData((d) => ({ ...d, [selectedTable]: parsed as Row[] }));
        }
      } catch {
        // invalid JSON — ignore
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const columns: Column<Row>[] = currentColumns.map((col) => ({
    key: col,
    label: col,
    sortable: true,
    render: (val) => {
      if (val === null || val === undefined)
        return <span className="text-gray-600 italic text-xs">null</span>;
      if (typeof val === "boolean") {
        return (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${val ? "text-green-400" : "text-red-400"}`}
          >
            {val ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {String(val)}
          </span>
        );
      }
      const str = String(val);
      if (str.length > 40) return <span title={str}>{str.slice(0, 38)}…</span>;
      return str;
    },
  }));

  const emptyRow: Row = Object.fromEntries(currentColumns.map((c) => [c, ""]));

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Data Browser</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="text-xs font-mono bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
              DEV-ONLY
            </span>{" "}
            Browse and edit local Fakebase table data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded-lg cursor-pointer transition-colors">
            <Upload className="h-4 w-4" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="sr-only"
            />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Row
          </button>
        </div>
      </div>

      {/* Table selector + filter */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-4 flex-wrap">
        <div className="relative">
          <select
            value={selectedTable}
            onChange={(e) => {
              setSelectedTable(e.target.value as TableName);
              setFilter(null);
            }}
            className="appearance-none bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {Object.keys(DEMO_TABLES).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        </div>
        <span className="text-xs text-gray-500 font-mono">
          {filteredRows.length} row{filteredRows.length !== 1 ? "s" : ""}
          {filter ? ` (filtered from ${rows.length})` : ""}
        </span>
        <div className="ml-auto">
          <FilterBar
            columns={currentColumns}
            filter={filter}
            onChange={setFilter}
            onClear={() => setFilter(null)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <DataTable
          columns={columns}
          data={filteredRows}
          onRowClick={(row) => {
            const idx = rows.indexOf(row);
            setEditRow({ ...row });
            setEditIndex(idx);
          }}
          actions={(row) => (
            <>
              <button
                onClick={() => {
                  const idx = rows.indexOf(row);
                  setEditRow({ ...row });
                  setEditIndex(idx);
                }}
                className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors rounded"
                title="Edit row"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDeleteRow(rows.indexOf(row))}
                className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded"
                title="Delete row"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          emptyMessage="No rows in this table. Add one to get started."
        />
      </div>

      {/* Add row modal */}
      <RowModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        columns={currentColumns}
        initialValues={emptyRow}
        onSave={handleAddRow}
        mode="add"
      />

      {/* Edit row modal */}
      {editRow !== null && (
        <RowModal
          open={true}
          onClose={() => {
            setEditRow(null);
            setEditIndex(null);
          }}
          columns={currentColumns}
          initialValues={editRow}
          onSave={handleEditRow}
          mode="edit"
        />
      )}
    </div>
  );
}
