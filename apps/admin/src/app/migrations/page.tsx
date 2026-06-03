"use client";

import { useState } from "react";
import {
  GitBranch,
  Eye,
  Play,
  ExternalLink,
  Download,
  Plus,
  CheckCircle,
  Clock,
} from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";

// ---------------------------------------------------------------------------
// Types & fixture data
// ---------------------------------------------------------------------------

interface Migration {
  id: string;
  filename: string;
  description: string;
  applied: boolean;
  applied_at?: string;
  sql: string;
}

const INITIAL_MIGRATIONS: Migration[] = [
  {
    id: "m-001",
    filename: "20240101_000000_create_users.sql",
    description: "Create users table with RLS",
    applied: true,
    applied_at: "2024-01-01T10:00:00Z",
    sql: `-- Migration: Create users table
-- Generated: 2024-01-01T10:00:00Z

CREATE TABLE public.users (
  id          uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email       text          NOT NULL UNIQUE,
  role        text          NOT NULL DEFAULT 'user',
  created_at  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY users_anon_read ON public.users
  FOR SELECT TO anon
  USING (true);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);`,
  },
  {
    id: "m-002",
    filename: "20240102_000000_create_posts.sql",
    description: "Create posts table with RLS",
    applied: true,
    applied_at: "2024-01-02T09:00:00Z",
    sql: `-- Migration: Create posts table
-- Generated: 2024-01-02T09:00:00Z

CREATE TABLE public.posts (
  id          uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text          NOT NULL,
  body        text,
  published   boolean       NOT NULL DEFAULT false,
  author_id   uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_public_read ON public.posts
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY posts_author_manage ON public.posts
  FOR ALL TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);`,
  },
  {
    id: "m-003",
    filename: "20240110_000000_add_email_confirmed.sql",
    description: "Add email_confirmed column to users",
    applied: false,
    sql: `-- Migration: Add email_confirmed to users
-- Generated: 2024-01-10T12:00:00Z

ALTER TABLE public.users
  ADD COLUMN email_confirmed boolean NOT NULL DEFAULT false;`,
  },
];

const DIFF_SQL = `-- Schema diff: local vs last applied migration
-- Generated: ${new Date().toISOString()}

-- Added column:
ALTER TABLE public.users
  ADD COLUMN email_confirmed boolean NOT NULL DEFAULT false;

-- No other changes detected.`;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MigrationsPage() {
  const [migrations, setMigrations] = useState<Migration[]>(INITIAL_MIGRATIONS);
  const [selectedMigration, setSelectedMigration] = useState<Migration | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const applied = migrations.filter((m) => m.applied);
  const pending = migrations.filter((m) => !m.applied);

  function handleApplyPending() {
    setMigrations((m) =>
      m.map((x) =>
        x.applied ? x : { ...x, applied: true, applied_at: new Date().toISOString() },
      ),
    );
  }

  function handleExport() {
    const allSql = migrations.map((m) => m.sql).join("\n\n-- ----\n\n");
    const blob = new Blob([allSql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "supabase_export.sql";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full">
      {/* Migration list */}
      <div className="w-80 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-sm font-semibold text-white flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-500" />
              Migrations
            </h1>
            <span className="text-xs font-mono bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
              DEV-ONLY
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {applied.length} applied · {pending.length} pending
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {migrations.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setSelectedMigration(m);
                setShowDiff(false);
              }}
              className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${selectedMigration?.id === m.id ? "bg-gray-800 border-blue-500" : "border-transparent hover:bg-gray-800/50"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {m.applied ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-yellow-400 flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${m.applied ? "text-green-400" : "text-yellow-400"}`}
                >
                  {m.applied ? "applied" : "pending"}
                </span>
              </div>
              <p className="text-xs font-mono text-gray-300 truncate">{m.filename}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{m.description}</p>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-gray-800 space-y-2">
          {pending.length > 0 && (
            <button
              onClick={handleApplyPending}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-white bg-green-700 hover:bg-green-600 rounded-lg transition-colors"
            >
              <Play className="h-3.5 w-3.5" /> Apply Pending ({pending.length})
            </button>
          )}
          <button
            onClick={() => {
              setSelectedMigration(null);
              setShowDiff(true);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Eye className="h-3.5 w-3.5" /> Generate Diff
          </button>
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Export to Supabase
          </button>
        </div>
      </div>

      {/* SQL viewer */}
      <div className="flex-1 overflow-auto p-6">
        {showDiff && !selectedMigration && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Schema Diff</h2>
              <button
                onClick={() => {
                  const blob = new Blob([DIFF_SQL], { type: "text/sql" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "schema.diff.sql";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded-lg transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
            <CodeBlock code={DIFF_SQL} language="sql" />
          </div>
        )}

        {selectedMigration && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">
                    {selectedMigration.filename}
                  </h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${selectedMigration.applied ? "text-green-400 bg-green-500/10" : "text-yellow-400 bg-yellow-500/10"}`}
                  >
                    {selectedMigration.applied ? "applied" : "pending"}
                  </span>
                </div>
                {selectedMigration.applied_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    Applied: {new Date(selectedMigration.applied_at).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const blob = new Blob([selectedMigration.sql], { type: "text/sql" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = selectedMigration.filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded-lg transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download SQL
              </button>
            </div>
            <CodeBlock code={selectedMigration.sql} language="sql" />
          </div>
        )}

        {!selectedMigration && !showDiff && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <GitBranch className="h-12 w-12 text-gray-700 mb-4" />
            <p className="text-gray-500 text-sm">Select a migration to view its SQL</p>
            <p className="text-xs text-gray-600 mt-1">
              Or generate a diff to see pending changes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
