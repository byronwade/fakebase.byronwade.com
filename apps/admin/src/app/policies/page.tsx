"use client";

import { useState } from "react";
import { Shield, ChevronDown, Check, X, AlertTriangle, Play } from "lucide-react";

// ---------------------------------------------------------------------------
// Types & fixture data
// ---------------------------------------------------------------------------

interface Policy {
  name: string;
  command: string;
  roles: string[];
  using?: string;
  withCheck?: string;
  permissive: boolean;
}

interface TablePolicy {
  table: string;
  rlsEnabled: boolean;
  policies: Policy[];
}

const TABLE_POLICIES: TablePolicy[] = [
  {
    table: "users",
    rlsEnabled: true,
    policies: [
      {
        name: "users_select_own",
        command: "SELECT",
        roles: ["authenticated"],
        using: "auth.uid() = id",
        permissive: true,
      },
      {
        name: "users_anon_read",
        command: "SELECT",
        roles: ["anon"],
        using: "true",
        permissive: true,
      },
      {
        name: "users_update_own",
        command: "UPDATE",
        roles: ["authenticated"],
        using: "auth.uid() = id",
        withCheck: "auth.uid() = id",
        permissive: true,
      },
    ],
  },
  {
    table: "posts",
    rlsEnabled: true,
    policies: [
      {
        name: "posts_public_read",
        command: "SELECT",
        roles: ["anon", "authenticated"],
        using: "published = true",
        permissive: true,
      },
      {
        name: "posts_author_manage",
        command: "ALL",
        roles: ["authenticated"],
        using: "auth.uid() = author_id",
        withCheck: "auth.uid() = author_id",
        permissive: true,
      },
      {
        name: "posts_admin_all",
        command: "ALL",
        roles: ["authenticated"],
        using: "auth.role() = 'admin'",
        withCheck: "auth.role() = 'admin'",
        permissive: true,
      },
    ],
  },
  {
    table: "comments",
    rlsEnabled: false,
    policies: [],
  },
];

const ALL_ROLES = ["anon", "authenticated", "service_role"];
const COMMANDS = ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"];

function evaluatePolicy(policy: Policy, role: string, userId: string): boolean {
  if (role === "service_role") return true;
  if (!policy.roles.includes(role) && !policy.roles.includes("*")) return false;

  const expr = policy.using ?? policy.withCheck ?? "true";
  if (expr === "true") return true;
  if (expr === "false") return false;
  if (expr.includes("auth.uid()")) return userId.length > 0;
  if (expr.includes("auth.role()")) return expr.includes(role);
  if (expr.includes("published = true")) return true;
  return true;
}

function getEffectiveAccess(
  table: TablePolicy,
  role: string,
  command: string,
  userId: string,
): "ALLOWED" | "DENIED" | "N/A" {
  if (!table.rlsEnabled) return role === "service_role" ? "ALLOWED" : "ALLOWED";
  if (role === "service_role") return "ALLOWED";
  if (table.policies.length === 0) return "DENIED";

  const matching = table.policies.filter(
    (p) => p.command === command || p.command === "ALL",
  );
  if (matching.length === 0) return "DENIED";

  const allowed = matching.some((p) => evaluatePolicy(p, role, userId));
  return allowed ? "ALLOWED" : "DENIED";
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PoliciesPage() {
  const [selectedTable, setSelectedTable] = useState<string>("users");
  const [testRole, setTestRole] = useState("authenticated");
  const [testUserId, setTestUserId] = useState("550e8400-e29b-41d4-a716-446655440000");
  const [testCommand, setTestCommand] = useState("SELECT");
  const [testResult, setTestResult] = useState<{
    allowed: boolean;
    reason: string;
  } | null>(null);

  const tableData = TABLE_POLICIES.find((t) => t.table === selectedTable);

  function runTest() {
    if (!tableData) return;
    const result = getEffectiveAccess(tableData, testRole, testCommand, testUserId);
    const allowed = result === "ALLOWED";
    const reasons: string[] = [];

    if (testRole === "service_role") {
      reasons.push("service_role bypasses all RLS");
    } else if (!tableData.rlsEnabled) {
      reasons.push(`${selectedTable} has RLS disabled — all roles have full access`);
    } else if (tableData.policies.length === 0) {
      reasons.push(
        "RLS enabled but no policies defined — all access denied by default",
      );
    } else {
      const matching = tableData.policies.filter(
        (p) => p.command === testCommand || p.command === "ALL",
      );
      if (matching.length === 0) {
        reasons.push(
          `No policy covers ${testCommand} on ${selectedTable} for ${testRole}`,
        );
      } else {
        for (const p of matching) {
          const passes = evaluatePolicy(p, testRole, testUserId);
          reasons.push(
            `Policy "${p.name}" (${p.command}): ${passes ? "✓ passes" : "✗ fails"} for role "${testRole}"`,
          );
        }
      }
    }

    setTestResult({ allowed, reason: reasons.join("\n") });
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white">Policy Viewer</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="text-xs font-mono bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
            DEV-ONLY
          </span>{" "}
          RLS policies are approximate JS evaluations — verify against real Supabase
        </p>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* Table selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">Table:</label>
          <div className="relative">
            <select
              value={selectedTable}
              onChange={(e) => {
                setSelectedTable(e.target.value);
                setTestResult(null);
              }}
              className="appearance-none bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-8 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {TABLE_POLICIES.map((t) => (
                <option key={t.table} value={t.table}>
                  {t.table}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </div>
          {tableData && (
            <span
              className={`text-xs px-2 py-1 rounded font-medium ${tableData.rlsEnabled ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}
            >
              RLS {tableData.rlsEnabled ? "enabled" : "disabled"}
            </span>
          )}
        </div>

        {/* Access matrix */}
        {tableData && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-300">
                Effective Access Matrix
              </h2>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="text-sm w-full">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900">
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Command
                    </th>
                    {ALL_ROLES.map((r) => (
                      <th
                        key={r}
                        className="px-4 py-3 text-center font-medium text-gray-400 font-mono"
                      >
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {COMMANDS.map((cmd) => (
                    <tr key={cmd} className="hover:bg-gray-800/40">
                      <td className="px-4 py-3 font-mono text-xs text-gray-300 font-semibold">
                        {cmd}
                      </td>
                      {ALL_ROLES.map((role) => {
                        const access = getEffectiveAccess(
                          tableData,
                          role,
                          cmd,
                          "some-user-id",
                        );
                        return (
                          <td key={role} className="px-4 py-3 text-center">
                            {access === "ALLOWED" ? (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-500/10">
                                <Check className="h-3.5 w-3.5 text-green-400" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-500/10">
                                <X className="h-3.5 w-3.5 text-red-400" />
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Policy details */}
        {tableData && tableData.policies.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-4">
              Policies ({tableData.policies.length})
            </h2>
            <div className="space-y-3">
              {tableData.policies.map((p) => (
                <div
                  key={p.name}
                  className="bg-gray-900 border border-gray-800 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold text-white">
                      {p.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                        {p.command}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${p.permissive ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"}`}
                      >
                        {p.permissive ? "PERMISSIVE" : "RESTRICTIVE"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-20">Roles:</span>
                      <span className="text-gray-300">{p.roles.join(", ")}</span>
                    </div>
                    {p.using && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-20">USING:</span>
                        <span className="text-yellow-400">{p.using}</span>
                      </div>
                    )}
                    {p.withCheck && (
                      <div className="flex gap-2">
                        <span className="text-gray-500 w-20">WITH CHECK:</span>
                        <span className="text-yellow-400">{p.withCheck}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Test access panel */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Play className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Test Access</h2>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Role
                </label>
                <select
                  value={testRole}
                  onChange={(e) => setTestRole(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  User ID (auth.uid())
                </label>
                <input
                  type="text"
                  value={testUserId}
                  onChange={(e) => setTestUserId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  placeholder="uuid..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Command
                </label>
                <select
                  value={testCommand}
                  onChange={(e) => setTestCommand(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {COMMANDS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={runTest}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              <Play className="h-4 w-4" /> Run Simulation
            </button>
            {testResult && (
              <div
                className={`p-4 rounded-lg border ${testResult.allowed ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {testResult.allowed ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <X className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={`font-semibold text-sm ${testResult.allowed ? "text-green-400" : "text-red-400"}`}
                  >
                    {testResult.allowed ? "ACCESS ALLOWED" : "ACCESS DENIED"}
                  </span>
                </div>
                <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap">
                  {testResult.reason}
                </pre>
                <div className="mt-3 flex items-start gap-2 text-xs text-yellow-400/70">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    This is a simplified simulation. Verify against real Supabase
                    PostgreSQL.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
