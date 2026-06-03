/**
 * Prompt generator for Fakebase — generates agent-specific prompts and config files
 * tailored to Cursor, Claude, GitHub Copilot, and generic AI agents.
 */

import type { ProjectSchemaIR } from "@byronwade/core";
import type { CapabilityEntry } from "@byronwade/core";
import { CapabilityStatus } from "@byronwade/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PromptTarget = "cursor" | "claude" | "copilot" | "generic";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSchemaContext(schema: ProjectSchemaIR): string {
  if (schema.tables.length === 0) return "No tables defined.";
  return schema.tables
    .map((t) => {
      const cols = t.columns
        .map(
          (c) =>
            `${c.name}: ${c.type}${c.nullable ? "" : " NOT NULL"}${c.primaryKey ? " PK" : ""}`,
        )
        .join(", ");
      return `- **${t.name}** (${cols}) — RLS: ${t.rlsEnabled ? "enabled" : "disabled"}`;
    })
    .join("\n");
}

function buildCapabilityWarnings(capabilities?: CapabilityEntry[]): string {
  if (!capabilities || capabilities.length === 0) return "";
  const stubs = capabilities.filter(
    (c) =>
      c.status === CapabilityStatus.STUB || c.status === CapabilityStatus.UNSUPPORTED,
  );
  if (stubs.length === 0) return "";
  return stubs
    .map((c) => `- \`${c.name}\` — ${c.status}${c.notes ? `: ${c.notes}` : ""}`)
    .join("\n");
}

function buildCoreGuidelines(): string {
  return [
    "1. **Local dev only** — Fakebase is never production. All data is ephemeral and local.",
    "2. **Never invent unsupported APIs** — if a capability is STUB or UNSUPPORTED, return `CapabilityError.notImplemented()` and explain the limitation.",
    "3. **RLS is approximate** — policy expressions are evaluated in JavaScript. Always note this limitation and recommend verifying against real Supabase.",
    "4. **Always export SQL migrations** before claiming backend work is complete. Use `fakebase export sql`.",
    "5. **Run `fakebase verify supabase`** before any production handoff.",
    "6. **Prefer Fakebase-compatible patterns** — use the `from()` query builder, not raw SQL. Use `auth.signInWithPassword()`, not custom JWT logic.",
  ].join("\n");
}

function buildClientUsage(): string {
  return `\`\`\`ts
import { createFakebaseClient } from "@byronwade/core";
import { JsonAdapter } from "@byronwade/adapter-json";

const client = createFakebaseClient({
  adapter: new JsonAdapter({ dir: ".fakebase" }),
  schema: projectSchema,
});

// Query with filter
const { data, error } = await client
  .from("users")
  .select("id, email, created_at")
  .eq("role", "admin");

// Insert
const { data, error } = await client
  .from("posts")
  .insert({ title: "Hello", author_id: userId });

// Auth
const { data: session } = await client.auth.signInWithPassword({
  email: "user@example.com",
  password: "secret",
});
\`\`\``;
}

// ---------------------------------------------------------------------------
// Main prompt generator
// ---------------------------------------------------------------------------

/**
 * Generates a targeted AI agent prompt for the given tool/platform.
 */
export function generateAgentPrompt(
  target: PromptTarget,
  schema: ProjectSchemaIR,
  options?: {
    task?: string;
    capabilities?: CapabilityEntry[];
  },
): string {
  const schemaContext = buildSchemaContext(schema);
  const capabilityWarnings = buildCapabilityWarnings(options?.capabilities);
  const guidelines = buildCoreGuidelines();
  const clientUsage = buildClientUsage();
  const taskContext = options?.task ? `\n**Current task:** ${options.task}\n` : "";

  switch (target) {
    case "cursor":
      return generateCursorPrompt(
        schema,
        schemaContext,
        capabilityWarnings,
        guidelines,
        clientUsage,
        taskContext,
      );
    case "claude":
      return generateClaudePrompt(
        schema,
        schemaContext,
        capabilityWarnings,
        guidelines,
        clientUsage,
        taskContext,
      );
    case "copilot":
      return generateCopilotPrompt(
        schema,
        schemaContext,
        capabilityWarnings,
        guidelines,
        clientUsage,
        taskContext,
      );
    case "generic":
    default:
      return generateGenericPrompt(
        schema,
        schemaContext,
        capabilityWarnings,
        guidelines,
        clientUsage,
        taskContext,
      );
  }
}

function generateCursorPrompt(
  schema: ProjectSchemaIR,
  schemaContext: string,
  capabilityWarnings: string,
  guidelines: string,
  clientUsage: string,
  taskContext: string,
): string {
  return `---
description: Fakebase local dev — schema v${schema.version} auto-generated rules
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: true
---

# Fakebase Local Dev Rules
${taskContext}
## Context

This project uses **Fakebase** — a Supabase-shaped local development platform that runs in-process.
It is **NOT** real Supabase. Auth, RLS, and storage are approximations for fast local prototyping.

## Schema (v${schema.version})

${schemaContext}

## Core Guidelines

${guidelines}

## Client Usage

${clientUsage}

${capabilityWarnings ? `## Unsupported Capabilities\n\n${capabilityWarnings}\n` : ""}
## Before Claiming Complete

- Run \`fakebase export sql\` and commit the migration file
- Run \`fakebase generate types\` and commit \`database.types.ts\`
- Run \`fakebase verify supabase\` and fix any compatibility warnings
`;
}

function generateClaudePrompt(
  schema: ProjectSchemaIR,
  schemaContext: string,
  capabilityWarnings: string,
  guidelines: string,
  clientUsage: string,
  taskContext: string,
): string {
  return `<system>
<context>
This project uses Fakebase — a Supabase-shaped local development runtime. Schema version: ${schema.version}.
Fakebase is NOT production Supabase. Auth, RLS, and storage are approximations. Never treat it as production.
</context>
${taskContext ? `<task>${taskContext.trim()}</task>` : ""}
<schema>
${schemaContext}
</schema>

<guidelines>
${guidelines}
</guidelines>

<client_usage>
${clientUsage}
</client_usage>

${capabilityWarnings ? `<unsupported_capabilities>\n${capabilityWarnings}\n</unsupported_capabilities>` : ""}

<completion_checklist>
Before claiming any backend feature is complete:
1. Export SQL: fakebase export sql
2. Generate types: fakebase generate types
3. Verify compatibility: fakebase verify supabase
</completion_checklist>
</system>`;
}

function generateCopilotPrompt(
  schema: ProjectSchemaIR,
  schemaContext: string,
  capabilityWarnings: string,
  guidelines: string,
  clientUsage: string,
  taskContext: string,
): string {
  return `# Fakebase Development Context
${taskContext}
This project uses Fakebase (local Supabase-shaped runtime, schema v${schema.version}).
NOT production Supabase — approximations only.

## Database Schema

${schemaContext}

## Rules

${guidelines}

## Client

${clientUsage}

${capabilityWarnings ? `## Do Not Use (Unsupported)\n\n${capabilityWarnings}` : ""}
`;
}

function generateGenericPrompt(
  schema: ProjectSchemaIR,
  schemaContext: string,
  capabilityWarnings: string,
  guidelines: string,
  clientUsage: string,
  taskContext: string,
): string {
  return `# Fakebase Project Context
${taskContext}
## What is Fakebase?

Fakebase is a **local-only, dev-only** Supabase-shaped runtime for Next.js prototypes.
It provides the same API surface as Supabase (database queries, auth, storage, realtime)
but runs entirely in-process — no network, no real PostgreSQL, no real auth.

**Schema version:** ${schema.version}

## Database Schema

${schemaContext}

## Core Rules

${guidelines}

## How to Use the Client

${clientUsage}

${capabilityWarnings ? `## Unsupported Capabilities (avoid these)\n\n${capabilityWarnings}\n` : ""}
## Pre-Production Checklist

Before deploying to real Supabase:
1. \`fakebase export sql\` — generate SQL migration files
2. \`fakebase generate types\` — regenerate \`database.types.ts\`
3. \`fakebase verify supabase\` — check for compatibility issues
4. Replace Fakebase client with \`@supabase/supabase-js\`
`;
}

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

/**
 * Generates `AGENTS.md` content for the project root.
 */
export function generateAgentsFile(schema: ProjectSchemaIR): string {
  return `# AGENTS.md — Fakebase Project

> Auto-generated by \`@byronwade/ai\`. Schema version **${schema.version}**.

## Overview

This project uses **Fakebase** — a Supabase-shaped local development platform.
Fakebase is **local/dev-only**. Never treat it as production.

## For AI Agents

### Database

${buildSchemaContext(schema)}

### Rules

${buildCoreGuidelines()}

### Client Usage

${buildClientUsage()}

### Completion Criteria

A backend feature is NOT complete until:
1. \`fakebase export sql\` has been run and the output committed
2. \`fakebase generate types\` has been run and \`database.types.ts\` updated
3. \`fakebase verify supabase\` reports no critical issues

### Architecture

- **Local adapter:** \`@byronwade/adapter-json\` (file-backed, stored in \`.fakebase/\`)
- **Auth:** \`@byronwade/auth\` (in-memory sessions, no real JWT verification)
- **Storage:** \`@byronwade/storage\` (local filesystem or memory)
- **Realtime:** \`@byronwade/realtime\` (in-process pub/sub, not WebSocket)
- **Admin UI:** \`apps/admin\` on \`http://localhost:54323\`
`;
}

/**
 * Generates `CLAUDE.md` content for projects using Claude as the AI assistant.
 */
export function generateClaudeFile(schema: ProjectSchemaIR): string {
  return `# CLAUDE.md — Fakebase Project

> Auto-generated by \`@byronwade/ai\`. Schema version **${schema.version}**.

## Project Context

This is a **Fakebase** project — a local-only Supabase-shaped development platform.
**This is NOT a production Supabase project.**

## Critical Constraints

1. **Local dev only** — never suggest deploying Fakebase to production
2. **RLS is approximate** — always caveat that RLS needs real Supabase validation
3. **No real JWT** — auth tokens are locally generated and not cryptographically verified by a real auth server
4. **No real network** — all operations happen in-process; network-dependent features won't work

## Database Schema (v${schema.version})

${buildSchemaContext(schema)}

## Guidelines

${buildCoreGuidelines()}

## Client Usage

${buildClientUsage()}

## When to Note Limitations

Always note Fakebase limitations when:
- Writing RLS policy logic (verify against real Supabase)
- Using auth features (not production-safe)
- Discussing storage (local filesystem only)
- Discussing realtime (in-process only, no external subscribers)
`;
}

/**
 * Generates `.cursor/rules/fakebase.mdc` content in Cursor MDC format.
 */
export function generateCursorRuleFile(schema: ProjectSchemaIR): string {
  const tables = schema.tables
    .map((t) => {
      const cols = t.columns.map((c) => `${c.name}:${c.type}`).join(", ");
      return `  - ${t.name} (${cols})`;
    })
    .join("\n");

  return `---
description: Fakebase local dev rules — auto-generated from schema v${schema.version}
globs:
  - "**/*.ts"
  - "**/*.tsx"
alwaysApply: true
---

# Fakebase Rules

This project uses Fakebase (local Supabase-shaped runtime). **Not production.**

## Schema Tables (v${schema.version})

${tables || "  (no tables)"}

## Critical Rules

- NEVER treat Fakebase as production Supabase
- NEVER invent unsupported APIs — return \`CapabilityError.notImplemented()\`
- ALWAYS note that RLS is approximate (JS evaluation, not real PostgreSQL)
- ALWAYS run \`fakebase export sql\` before claiming backend work is complete
- ALWAYS run \`fakebase verify supabase\` before production handoff

## Client Import

\`\`\`ts
import { createFakebaseClient } from "@byronwade/core";
import { JsonAdapter } from "@byronwade/adapter-json";
\`\`\`

## Completion Checklist

- [ ] \`fakebase export sql\` committed
- [ ] \`fakebase generate types\` committed
- [ ] \`fakebase verify supabase\` passes
`;
}
