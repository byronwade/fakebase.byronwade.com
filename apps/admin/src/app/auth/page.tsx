"use client";

import { useState } from "react";
import { Plus, Trash2, Ban, Mail, Clock, LogIn, X, Check } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import type { Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
  email_confirmed: boolean;
  banned: boolean;
}

interface OtpEntry {
  email: string;
  token: string;
  type: string;
  expires_at: string;
  created_at: string;
}

interface Session {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
  expires_at: string;
  user_agent: string;
}

const INITIAL_USERS: User[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "alice@example.com",
    role: "admin",
    created_at: "2024-01-01T10:00:00Z",
    email_confirmed: true,
    banned: false,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "bob@example.com",
    role: "user",
    created_at: "2024-01-02T11:30:00Z",
    email_confirmed: true,
    banned: false,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    email: "carol@example.com",
    role: "user",
    created_at: "2024-01-03T09:15:00Z",
    email_confirmed: false,
    banned: false,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    email: "dave@example.com",
    role: "moderator",
    created_at: "2024-01-04T14:00:00Z",
    email_confirmed: true,
    banned: true,
  },
];

const INITIAL_OTP: OtpEntry[] = [
  {
    email: "carol@example.com",
    token: "123456",
    type: "email",
    expires_at: "2024-01-10T10:10:00Z",
    created_at: "2024-01-10T10:00:00Z",
  },
  {
    email: "bob@example.com",
    token: "789012",
    type: "magiclink",
    expires_at: "2024-01-10T10:20:00Z",
    created_at: "2024-01-10T10:10:00Z",
  },
  {
    email: "bob@example.com",
    token: "345678",
    type: "phone_change",
    expires_at: "2024-01-10T10:30:00Z",
    created_at: "2024-01-10T10:20:00Z",
  },
];

const INITIAL_SESSIONS: Session[] = [
  {
    id: "sess-0001",
    user_id: "550e8400-e29b-41d4-a716-446655440000",
    email: "alice@example.com",
    created_at: "2024-01-10T09:00:00Z",
    expires_at: "2024-01-17T09:00:00Z",
    user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  },
  {
    id: "sess-0002",
    user_id: "550e8400-e29b-41d4-a716-446655440001",
    email: "bob@example.com",
    created_at: "2024-01-10T10:00:00Z",
    expires_at: "2024-01-17T10:00:00Z",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  },
];

// ---------------------------------------------------------------------------
// Create User modal
// ---------------------------------------------------------------------------

function CreateUserModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (u: User) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [confirmed, setConfirmed] = useState(false);

  function handleCreate() {
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      role,
      created_at: new Date().toISOString(),
      email_confirmed: confirmed,
      banned: false,
    };
    onCreate(newUser);
    setEmail("");
    setRole("user");
    setConfirmed(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Create User" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {["user", "admin", "moderator", "service_role"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-300">Email confirmed</span>
        </label>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!email}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
        >
          Create User
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AuthPage() {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [otpEntries] = useState<OtpEntry[]>(INITIAL_OTP);
  const [sessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [createOpen, setCreateOpen] = useState(false);

  function handleDelete(id: string) {
    setUsers((u) => u.filter((x) => x.id !== id));
  }

  function handleToggleBan(id: string) {
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, banned: !x.banned } : x)));
  }

  const userColumns: Column<User>[] = [
    {
      key: "email",
      label: "Email",
      sortable: true,
      render: (val, row) => (
        <div>
          <span className="text-white">{String(val)}</span>
          {row.banned && (
            <span className="ml-2 text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
              banned
            </span>
          )}
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (val) => (
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${val === "admin" ? "text-yellow-400 bg-yellow-500/10" : "text-blue-400 bg-blue-500/10"}`}
        >
          {String(val)}
        </span>
      ),
    },
    { key: "created_at", label: "Created", sortable: true },
    {
      key: "email_confirmed",
      label: "Confirmed",
      render: (val) =>
        val ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : (
          <X className="h-4 w-4 text-red-400" />
        ),
    },
  ];

  const otpColumns: Column<OtpEntry>[] = [
    { key: "email", label: "Email", sortable: true },
    {
      key: "token",
      label: "Token",
      render: (v) => <span className="font-mono text-yellow-400">{String(v)}</span>,
    },
    { key: "type", label: "Type" },
    { key: "expires_at", label: "Expires" },
    { key: "created_at", label: "Created" },
  ];

  const sessionColumns: Column<Session>[] = [
    { key: "id", label: "Session ID" },
    { key: "email", label: "User", sortable: true },
    { key: "created_at", label: "Started" },
    { key: "expires_at", label: "Expires" },
    {
      key: "user_agent",
      label: "User Agent",
      render: (v) => (
        <span title={String(v)} className="truncate max-w-[200px] inline-block">
          {String(v).slice(0, 30)}…
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Auth Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            <span className="text-xs font-mono bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
              DEV-ONLY
            </span>{" "}
            Manage users, OTP tokens, and sessions
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" /> Create User
        </button>
      </div>

      <div className="px-6 py-6 space-y-10">
        {/* Users table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Users</h2>
            <span className="text-xs text-gray-600 font-mono">({users.length})</span>
          </div>
          <DataTable
            columns={userColumns}
            data={users}
            searchable
            searchPlaceholder="Search users..."
            actions={(row) => (
              <>
                <button
                  onClick={() => handleToggleBan(row.id)}
                  className={`p-1.5 transition-colors rounded ${row.banned ? "text-yellow-400 hover:text-white" : "text-gray-500 hover:text-yellow-400"}`}
                  title={row.banned ? "Unban user" : "Ban user"}
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(row.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded"
                  title="Delete user"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            emptyMessage="No users found."
          />
        </section>

        {/* OTP Inbox */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">OTP Inbox</h2>
            <span className="text-xs text-gray-600 font-mono">
              ({otpEntries.length} recent tokens)
            </span>
          </div>
          <DataTable
            columns={otpColumns}
            data={otpEntries}
            emptyMessage="No recent OTP tokens."
          />
        </section>

        {/* Sessions */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <LogIn className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Active Sessions</h2>
            <span className="text-xs text-gray-600 font-mono">({sessions.length})</span>
          </div>
          <DataTable
            columns={sessionColumns}
            data={sessions}
            emptyMessage="No active sessions."
          />
        </section>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
          <Clock className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-400/80">
            <span className="font-medium text-yellow-400">Dev-only auth</span> —
            sessions and tokens are ephemeral. Auth is not cryptographically verified.
            Do not use for production security.
          </div>
        </div>
      </div>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(u) => setUsers((prev) => [u, ...prev])}
      />
    </div>
  );
}
