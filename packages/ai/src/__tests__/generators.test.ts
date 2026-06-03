import { describe, it, expect } from "vitest";
import type { ProjectSchemaIR, CapabilityEntry } from "@byronwade/core";
import { CapabilityStatus } from "@byronwade/core";
import {
  generateFakebaseRules,
  generateSchemasSummary,
  generatePoliciesSummary,
  generateCompatibilitySummary,
  generateMigrationChecklist,
} from "../rules-generator.js";
import {
  generateAgentPrompt,
  generateAgentsFile,
  generateClaudeFile,
  generateCursorRuleFile,
} from "../prompt-generator.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const testSchema: ProjectSchemaIR = {
  version: 42,
  tables: [
    {
      schema: "public",
      name: "users",
      primaryKey: "id",
      rlsEnabled: true,
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true },
        { name: "email", type: "text", nullable: false, unique: true },
        { name: "role", type: "text", nullable: false, defaultSql: "'user'" },
        { name: "created_at", type: "timestamptz", nullable: false },
      ],
      indexes: [{ name: "users_email_idx", columns: ["email"], unique: true }],
      policies: [
        {
          name: "users_select_own",
          table: "users",
          schema: "public",
          command: "SELECT",
          roles: ["authenticated"],
          using: "auth.uid() = id",
          permissive: true,
        },
        {
          name: "users_anon_read",
          table: "users",
          schema: "public",
          command: "SELECT",
          roles: ["anon"],
          using: "true",
          permissive: true,
        },
      ],
    },
    {
      schema: "public",
      name: "posts",
      primaryKey: "id",
      rlsEnabled: false,
      columns: [
        { name: "id", type: "uuid", nullable: false, primaryKey: true },
        { name: "title", type: "text", nullable: false },
        {
          name: "author_id",
          type: "uuid",
          nullable: false,
          references: { table: "users", column: "id" },
        },
      ],
      indexes: [],
      policies: [],
    },
  ],
  enums: [
    {
      schema: "public",
      name: "user_role",
      values: ["admin", "user", "moderator"],
    },
  ],
  functions: [
    {
      schema: "public",
      name: "get_user_posts",
      args: [{ name: "user_id", type: "uuid" }],
      returnType: "setof posts",
      language: "sql",
    },
  ],
};

const testCapabilities: CapabilityEntry[] = [
  {
    name: "database.select",
    status: CapabilityStatus.SUPPORTED,
    notes: "Full support",
  },
  { name: "database.insert", status: CapabilityStatus.SUPPORTED },
  {
    name: "database.rpc",
    status: CapabilityStatus.PARTIAL,
    notes: "Simple expressions only",
  },
  { name: "auth.signInWithPassword", status: CapabilityStatus.SUPPORTED },
  {
    name: "storage.signedUrls",
    status: CapabilityStatus.STUB,
    notes: "Returns CapabilityError",
  },
  {
    name: "realtime.broadcast",
    status: CapabilityStatus.UNSUPPORTED,
    notes: "No external WebSocket",
  },
];

// ---------------------------------------------------------------------------
// generateFakebaseRules
// ---------------------------------------------------------------------------

describe("generateFakebaseRules", () => {
  it("includes project overview section", () => {
    const result = generateFakebaseRules(testSchema);
    expect(result).toContain("## Project Overview");
    expect(result).toContain("Fakebase");
  });

  it("includes CRITICAL warnings section", () => {
    const result = generateFakebaseRules(testSchema);
    expect(result).toContain("## ⚠️ CRITICAL Warnings");
    expect(result).toContain("local/dev-only");
    expect(result).toContain("RLS is approximate");
    expect(result).toContain("CapabilityError.notImplemented()");
    expect(result).toContain("fakebase export sql");
    expect(result).toContain("fakebase verify supabase");
  });

  it("includes schema tables section with all tables", () => {
    const result = generateFakebaseRules(testSchema);
    expect(result).toContain("## Schema Tables");
    expect(result).toContain("users");
    expect(result).toContain("posts");
  });

  it("includes client usage section", () => {
    const result = generateFakebaseRules(testSchema);
    expect(result).toContain("## Client Usage");
    expect(result).toContain("createFakebaseClient");
    expect(result).toContain('from("users")');
  });

  it("includes migration workflow section", () => {
    const result = generateFakebaseRules(testSchema);
    expect(result).toContain("## Migration Workflow");
  });

  it("includes unsupported capabilities section", () => {
    const result = generateFakebaseRules(testSchema);
    expect(result).toContain("## Unsupported Capabilities");
    expect(result).toContain("CapabilityError.notImplemented()");
  });

  it("uses projectName option when provided", () => {
    const result = generateFakebaseRules(testSchema, { projectName: "MyApp" });
    expect(result).toContain("MyApp");
  });

  it("uses adapterType option in client usage", () => {
    const result = generateFakebaseRules(testSchema, { adapterType: "memory" });
    expect(result).toContain("adapter-memory");
  });

  it("shows schema version", () => {
    const result = generateFakebaseRules(testSchema);
    expect(result).toContain("42");
  });
});

// ---------------------------------------------------------------------------
// generateSchemasSummary
// ---------------------------------------------------------------------------

describe("generateSchemasSummary", () => {
  it("contains Schema Summary heading", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("# Schema Summary");
  });

  it("lists all tables", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("`users`");
    expect(result).toContain("`posts`");
  });

  it("describes columns", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("`id`");
    expect(result).toContain("`email`");
    expect(result).toContain("uuid");
    expect(result).toContain("text");
  });

  it("shows enum types", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("## Enums");
    expect(result).toContain("`user_role`");
    expect(result).toContain("`admin`");
  });

  it("shows functions", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("## Functions");
    expect(result).toContain("`get_user_posts`");
  });

  it("shows foreign key relationships", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("users.id");
  });

  it("shows RLS status per table", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("✅ enabled");
    expect(result).toContain("❌ disabled");
  });

  it("lists the RLS policies of tables that have them", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("users_select_own");
    expect(result).toContain("users_anon_read");
    expect(result).toContain("auth.uid() = id");
  });

  it("includes schema version", () => {
    const result = generateSchemasSummary(testSchema);
    expect(result).toContain("42");
  });
});

// ---------------------------------------------------------------------------
// generatePoliciesSummary
// ---------------------------------------------------------------------------

describe("generatePoliciesSummary", () => {
  it("contains RLS Policies Summary heading", () => {
    const result = generatePoliciesSummary(testSchema);
    expect(result).toContain("# RLS Policies Summary");
  });

  it("includes limitations section", () => {
    const result = generatePoliciesSummary(testSchema);
    expect(result).toContain("Known Limitations");
    expect(result).toContain("JavaScript");
  });

  it("shows role access matrix", () => {
    const result = generatePoliciesSummary(testSchema);
    expect(result).toContain("## Role Access Matrix");
    expect(result).toContain("anon");
    expect(result).toContain("authenticated");
    expect(result).toContain("service_role");
  });

  it("lists tables without RLS", () => {
    const result = generatePoliciesSummary(testSchema);
    expect(result).toContain("## Tables Without RLS");
    expect(result).toContain("`posts`");
  });

  it("shows policy details", () => {
    const result = generatePoliciesSummary(testSchema);
    expect(result).toContain("users_select_own");
    expect(result).toContain("auth.uid() = id");
  });
});

// ---------------------------------------------------------------------------
// generateCompatibilitySummary
// ---------------------------------------------------------------------------

describe("generateCompatibilitySummary", () => {
  it("contains Capability Compatibility Matrix heading", () => {
    const result = generateCompatibilitySummary(testCapabilities);
    expect(result).toContain("# Capability Compatibility Matrix");
  });

  it("shows all status types", () => {
    const result = generateCompatibilitySummary(testCapabilities);
    expect(result).toContain("SUPPORTED");
    expect(result).toContain("PARTIAL");
    expect(result).toContain("STUB");
    expect(result).toContain("UNSUPPORTED");
  });

  it("lists all capability names", () => {
    const result = generateCompatibilitySummary(testCapabilities);
    expect(result).toContain("database.select");
    expect(result).toContain("storage.signedUrls");
    expect(result).toContain("realtime.broadcast");
  });

  it("shows summary counts", () => {
    const result = generateCompatibilitySummary(testCapabilities);
    expect(result).toContain("| ✅ SUPPORTED | 3 |");
    expect(result).toContain("| ⚠️ PARTIAL | 1 |");
    expect(result).toContain("| 🔶 STUB | 1 |");
    expect(result).toContain("| ❌ UNSUPPORTED | 1 |");
  });

  it("handles empty capabilities array", () => {
    const result = generateCompatibilitySummary([]);
    expect(result).toContain("# Capability Compatibility Matrix");
    expect(result).toContain("**Total** | **0**");
  });
});

// ---------------------------------------------------------------------------
// generateMigrationChecklist
// ---------------------------------------------------------------------------

describe("generateMigrationChecklist", () => {
  it("contains Migration Checklist heading", () => {
    const result = generateMigrationChecklist();
    expect(result).toContain("# Migration Checklist");
  });

  it("includes all checklist sections", () => {
    const result = generateMigrationChecklist();
    expect(result).toContain("### Schema");
    expect(result).toContain("### Types");
    expect(result).toContain("### Verification");
    expect(result).toContain("### Production Handoff");
  });

  it("shows unchecked items when no options provided", () => {
    const result = generateMigrationChecklist();
    expect(result).toContain("[ ] Export SQL migrations");
  });

  it("shows checked items when options are true", () => {
    const result = generateMigrationChecklist({
      hasExportedSql: true,
      hasGeneratedTypes: true,
      hasRunVerify: true,
    });
    expect(result).toContain("[x] Export SQL migrations");
    expect(result).toContain("[x] Generate TypeScript types");
    expect(result).toContain("[x] Run `fakebase verify supabase`");
  });

  it("lists pending migrations when provided", () => {
    const result = generateMigrationChecklist({
      pendingMigrations: ["20240101_create_users.sql", "20240102_add_posts.sql"],
    });
    expect(result).toContain("20240101_create_users.sql");
    expect(result).toContain("20240102_add_posts.sql");
  });

  it("mentions fakebase CLI commands", () => {
    const result = generateMigrationChecklist();
    expect(result).toContain("fakebase export sql");
    expect(result).toContain("fakebase generate types");
    expect(result).toContain("fakebase verify supabase");
  });
});

// ---------------------------------------------------------------------------
// generateAgentPrompt
// ---------------------------------------------------------------------------

describe("generateAgentPrompt", () => {
  it("generates cursor format with frontmatter", () => {
    const result = generateAgentPrompt("cursor", testSchema);
    expect(result).toContain("---");
    expect(result).toContain("description:");
    expect(result).toContain("alwaysApply: true");
    expect(result).toContain("# Fakebase Local Dev Rules");
  });

  it("generates claude format with XML structure", () => {
    const result = generateAgentPrompt("claude", testSchema);
    expect(result).toContain("<system>");
    expect(result).toContain("<context>");
    expect(result).toContain("<schema>");
    expect(result).toContain("<guidelines>");
    expect(result).toContain("</system>");
  });

  it("generates copilot format with markdown headers", () => {
    const result = generateAgentPrompt("copilot", testSchema);
    expect(result).toContain("# Fakebase Development Context");
    expect(result).toContain("## Database Schema");
    expect(result).toContain("## Rules");
  });

  it("generates generic format with clear sections", () => {
    const result = generateAgentPrompt("generic", testSchema);
    expect(result).toContain("# Fakebase Project Context");
    expect(result).toContain("## Database Schema");
    expect(result).toContain("## Core Rules");
    expect(result).toContain("## How to Use the Client");
  });

  it("includes schema tables in all targets", () => {
    const targets: Array<"cursor" | "claude" | "copilot" | "generic"> = [
      "cursor",
      "claude",
      "copilot",
      "generic",
    ];
    for (const target of targets) {
      const result = generateAgentPrompt(target, testSchema);
      expect(result).toContain("users");
      expect(result).toContain("posts");
    }
  });

  it("includes task context when provided", () => {
    const result = generateAgentPrompt("generic", testSchema, {
      task: "Build a user registration form",
    });
    expect(result).toContain("Build a user registration form");
  });

  it("includes capability warnings for stub/unsupported", () => {
    const result = generateAgentPrompt("generic", testSchema, {
      capabilities: testCapabilities,
    });
    expect(result).toContain("storage.signedUrls");
    expect(result).toContain("realtime.broadcast");
    expect(result).not.toContain("database.select");
  });
});

// ---------------------------------------------------------------------------
// generateAgentsFile
// ---------------------------------------------------------------------------

describe("generateAgentsFile", () => {
  it("contains AGENTS.md heading", () => {
    const result = generateAgentsFile(testSchema);
    expect(result).toContain("# AGENTS.md");
  });

  it("lists schema tables", () => {
    const result = generateAgentsFile(testSchema);
    expect(result).toContain("users");
    expect(result).toContain("posts");
  });

  it("mentions adapter architecture", () => {
    const result = generateAgentsFile(testSchema);
    expect(result).toContain("@byronwade/adapter-json");
    expect(result).toContain("@byronwade/auth");
  });

  it("includes completion criteria", () => {
    const result = generateAgentsFile(testSchema);
    expect(result).toContain("Completion Criteria");
    expect(result).toContain("fakebase export sql");
  });
});

// ---------------------------------------------------------------------------
// generateClaudeFile
// ---------------------------------------------------------------------------

describe("generateClaudeFile", () => {
  it("contains CLAUDE.md heading", () => {
    const result = generateClaudeFile(testSchema);
    expect(result).toContain("# CLAUDE.md");
  });

  it("lists critical constraints", () => {
    const result = generateClaudeFile(testSchema);
    expect(result).toContain("Critical Constraints");
    expect(result).toContain("Local dev only");
  });

  it("shows schema", () => {
    const result = generateClaudeFile(testSchema);
    expect(result).toContain("Database Schema");
    expect(result).toContain("users");
  });

  it("includes when to note limitations", () => {
    const result = generateClaudeFile(testSchema);
    expect(result).toContain("When to Note Limitations");
  });
});

// ---------------------------------------------------------------------------
// generateCursorRuleFile
// ---------------------------------------------------------------------------

describe("generateCursorRuleFile", () => {
  it("has frontmatter with description and globs", () => {
    const result = generateCursorRuleFile(testSchema);
    expect(result.startsWith("---")).toBe(true);
    expect(result).toContain("description:");
    expect(result).toContain("globs:");
    expect(result).toContain("alwaysApply: true");
  });

  it("lists table names", () => {
    const result = generateCursorRuleFile(testSchema);
    expect(result).toContain("users");
    expect(result).toContain("posts");
  });

  it("contains critical rules", () => {
    const result = generateCursorRuleFile(testSchema);
    expect(result).toContain("NEVER treat Fakebase as production");
    expect(result).toContain("CapabilityError.notImplemented()");
    expect(result).toContain("fakebase export sql");
  });

  it("includes completion checklist", () => {
    const result = generateCursorRuleFile(testSchema);
    expect(result).toContain("Completion Checklist");
    expect(result).toContain("[ ] `fakebase export sql` committed");
  });
});
