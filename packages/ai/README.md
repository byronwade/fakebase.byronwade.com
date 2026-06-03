# `@fakebase/ai`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

Generates AI rules, schema summaries, and editor prompt files (Cursor / Claude / AGENTS) from your Fakebase schema, so coding agents understand your local backend and its capability limits.

## Installation

```bash
pnpm add -D @fakebase/ai
```

## Usage

```ts
import { generateFakebaseRules, generateAgentPrompt } from "@fakebase/ai";

const rules = generateFakebaseRules(schema, { projectName: "my-app" });
const prompt = generateAgentPrompt("cursor", schema);
```

## What's inside

- Rules + summaries: `generateFakebaseRules`, `generateSchemasSummary`, `generatePoliciesSummary`, `generateCompatibilitySummary`, `generateMigrationChecklist`.
- Prompt/file generators: `generateAgentPrompt`, `generateAgentsFile`, `generateClaudeFile`, `generateCursorRuleFile` (+ type `PromptTarget`).

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
