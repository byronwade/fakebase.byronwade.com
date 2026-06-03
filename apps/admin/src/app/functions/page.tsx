"use client";

import { useState } from "react";
import { Zap, Play, ChevronRight, CheckCircle, XCircle, Clock } from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";

// ---------------------------------------------------------------------------
// Types & fixture data
// ---------------------------------------------------------------------------

interface FunctionArg {
  name: string;
  type: string;
  required: boolean;
}

interface RegisteredFunction {
  id: string;
  name: string;
  description: string;
  args: FunctionArg[];
  returnType: string;
  language: string;
  body: string;
}

interface InvocationLog {
  id: string;
  functionName: string;
  args: Record<string, string>;
  result: unknown;
  error: string | null;
  duration_ms: number;
  timestamp: string;
}

const FUNCTIONS: RegisteredFunction[] = [
  {
    id: "fn-001",
    name: "get_user_posts",
    description: "Returns all posts authored by the given user",
    args: [{ name: "user_id", type: "uuid", required: true }],
    returnType: "setof posts",
    language: "sql",
    body: `SELECT * FROM posts WHERE author_id = user_id ORDER BY created_at DESC;`,
  },
  {
    id: "fn-002",
    name: "get_recent_activity",
    description: "Returns the N most recent rows across all tables",
    args: [{ name: "limit_count", type: "integer", required: false }],
    returnType: "json",
    language: "plpgsql",
    body: `DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(p))
  INTO result
  FROM (
    SELECT 'post' AS type, id, created_at FROM posts
    UNION ALL
    SELECT 'comment' AS type, id, created_at FROM comments
    ORDER BY created_at DESC
    LIMIT COALESCE(limit_count, 10)
  ) p;
  RETURN result;
END;`,
  },
  {
    id: "fn-003",
    name: "count_users_by_role",
    description: "Returns a count of users grouped by their role",
    args: [],
    returnType: "table(role text, count bigint)",
    language: "sql",
    body: `SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC;`,
  },
];

const MOCK_RESULTS: Record<string, unknown> = {
  get_user_posts: [
    {
      id: "a1b2c3d4-0001-0000-0000-000000000000",
      title: "Hello World",
      published: true,
      author_id: "550e8400-e29b-41d4-a716-446655440000",
    },
    {
      id: "a1b2c3d4-0002-0000-0000-000000000000",
      title: "Getting Started",
      published: false,
      author_id: "550e8400-e29b-41d4-a716-446655440000",
    },
  ],
  get_recent_activity: [
    {
      type: "post",
      id: "a1b2c3d4-0001-0000-0000-000000000000",
      created_at: "2024-01-10T08:00:00Z",
    },
    {
      type: "comment",
      id: "c0000001-0000-0000-0000-000000000000",
      created_at: "2024-01-12T10:00:00Z",
    },
  ],
  count_users_by_role: [
    { role: "user", count: 2 },
    { role: "admin", count: 1 },
    { role: "moderator", count: 1 },
  ],
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FunctionsPage() {
  const [selectedFn, setSelectedFn] = useState<RegisteredFunction | null>(
    FUNCTIONS[0] ?? null,
  );
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<InvocationLog[]>([]);
  const [isInvoking, setIsInvoking] = useState(false);
  const [showBody, setShowBody] = useState(false);

  async function handleInvoke() {
    if (!selectedFn) return;
    setIsInvoking(true);
    const start = Date.now();
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    const duration = Date.now() - start;

    const result = MOCK_RESULTS[selectedFn.name] ?? {
      message: "Function executed successfully",
    };
    const entry: InvocationLog = {
      id: `log-${Date.now()}`,
      functionName: selectedFn.name,
      args: { ...argValues },
      result,
      error: null,
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    };
    setLogs((l) => [entry, ...l].slice(0, 20));
    setIsInvoking(false);
  }

  return (
    <div className="flex h-full">
      {/* Function list */}
      <div className="w-64 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-2">
          <Zap className="h-4 w-4 text-gray-500" />
          <h1 className="text-sm font-semibold text-white">Functions</h1>
          <span className="text-xs text-gray-600 ml-auto font-mono">
            {FUNCTIONS.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {FUNCTIONS.map((fn) => (
            <button
              key={fn.id}
              onClick={() => {
                setSelectedFn(fn);
                setArgValues({});
                setShowBody(false);
              }}
              className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${selectedFn?.id === fn.id ? "bg-gray-800 border-blue-500" : "border-transparent hover:bg-gray-800/50"}`}
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={`h-3.5 w-3.5 flex-shrink-0 ${selectedFn?.id === fn.id ? "text-blue-400" : "text-gray-600"}`}
                />
                <span className="font-mono text-xs text-gray-300 truncate">
                  {fn.name}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-1 pl-5 truncate">
                {fn.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Function runner */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFn ? (
          <>
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold text-white font-mono">
                    {selectedFn.name}()
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {selectedFn.description}
                  </p>
                </div>
                <span className="text-xs font-mono bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
                  DEV-ONLY
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 font-mono">
                <span>
                  returns:{" "}
                  <span className="text-blue-400">{selectedFn.returnType}</span>
                </span>
                <span>
                  language:{" "}
                  <span className="text-green-400">{selectedFn.language}</span>
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
              {/* Args form */}
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Arguments
                </h3>
                {selectedFn.args.length === 0 ? (
                  <p className="text-sm text-gray-600 italic">No arguments required.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedFn.args.map((arg) => (
                      <div key={arg.name} className="flex items-center gap-4">
                        <label className="text-xs font-mono text-gray-400 w-36 flex-shrink-0">
                          {arg.name}
                          <span className="text-gray-600 ml-1">: {arg.type}</span>
                          {arg.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <input
                          type="text"
                          value={argValues[arg.name] ?? ""}
                          onChange={(e) =>
                            setArgValues((v) => ({ ...v, [arg.name]: e.target.value }))
                          }
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                          placeholder={`Enter ${arg.type}...`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleInvoke}
                  disabled={isInvoking}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                >
                  <Play className={`h-4 w-4 ${isInvoking ? "animate-pulse" : ""}`} />
                  {isInvoking ? "Invoking..." : "Invoke"}
                </button>
                <button
                  onClick={() => setShowBody((s) => !s)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showBody ? "Hide" : "Show"} function body
                </button>
              </div>

              {showBody && (
                <CodeBlock code={selectedFn.body} language={selectedFn.language} />
              )}

              {/* Invocation log */}
              {logs.filter((l) => l.functionName === selectedFn.name).length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Invocation Log
                  </h3>
                  <div className="space-y-3">
                    {logs
                      .filter((l) => l.functionName === selectedFn.name)
                      .map((log) => (
                        <div
                          key={log.id}
                          className="bg-gray-900 border border-gray-800 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {log.error ? (
                                <XCircle className="h-4 w-4 text-red-400" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-400" />
                              )}
                              <span
                                className={`text-xs font-semibold ${log.error ? "text-red-400" : "text-green-400"}`}
                              >
                                {log.error ? "Error" : "Success"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span>
                                <Clock className="h-3 w-3 inline mr-1" />
                                {log.duration_ms}ms
                              </span>
                              <span>
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          {Object.keys(log.args).length > 0 && (
                            <div className="text-xs font-mono text-gray-500 mb-2">
                              Args: {JSON.stringify(log.args)}
                            </div>
                          )}
                          {log.error ? (
                            <div className="text-xs text-red-400 font-mono">
                              {log.error}
                            </div>
                          ) : (
                            <CodeBlock
                              code={JSON.stringify(log.result, null, 2)}
                              language="json"
                              showCopy={false}
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </section>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-center">
            <div>
              <Zap className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Select a function to invoke it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
