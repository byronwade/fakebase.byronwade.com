# Contributing to Fakebase

Thanks for your interest in improving Fakebase! This document explains how to
set up the repo, the conventions we follow, and how to get a change merged.

> **Reminder:** Fakebase is a **local/dev-only** Supabase-shaped platform for
> prototypes. It is intentionally **not** production infrastructure. Contributions
> should preserve that contract — see [`docs/security.md`](docs/security.md).

## Prerequisites

- **Node.js** `>=20` (an `.nvmrc` is provided — run `nvm use`)
- **pnpm** `>=9` (`corepack enable` will provide it)

## Getting started

```bash
git clone https://github.com/byronwade/fakebase.git
cd fakebase
pnpm install
pnpm build
pnpm test
```

This is a [pnpm](https://pnpm.io) + [Turborepo](https://turbo.build) monorepo.
Common tasks run across every package:

| Command          | What it does                           |
| ---------------- | -------------------------------------- |
| `pnpm build`     | Type-check and compile every package   |
| `pnpm test`      | Run all unit + contract tests (Vitest) |
| `pnpm test:e2e`  | Run the admin UI Playwright tests      |
| `pnpm lint`      | ESLint across the workspace            |
| `pnpm format`    | Prettier write                         |
| `pnpm typecheck` | `tsc --noEmit` across the workspace    |

You can scope any task to one package with Turbo filters, e.g.
`pnpm turbo run test --filter=@fakebase/core`.

## Repo layout

- `packages/*` — publishable libraries (`fakebase`, `@fakebase/*`)
- `apps/*` — docs site, dev-only admin UI, and the Next.js playground
- `examples/*`, `templates/*` — standalone, copy-pasteable starters
- `docs/*` — architecture, compatibility, migration, security, CLI, admin, AI

See [`docs/architecture.md`](docs/architecture.md) for how the pieces fit together.

## Adding a new adapter

Every persistence backend must satisfy the **same** behavioural contract. Add a
test that runs the shared suite from `@fakebase/test-utils`:

```ts
import { defineAdapterContractSuite, TEST_SCHEMA } from "@fakebase/test-utils";
// ...wire your adapter factory and let the suite verify CRUD/filters/RLS.
```

The cross-adapter suite lives in
`packages/test-utils/src/__tests__/adapters.contract.test.ts`.

## Coding standards

- **TypeScript strict** everywhere. No `any` without a justified
  `eslint-disable` and a comment.
- **No silent fakes.** Unsupported Supabase surface must return a structured
  `CapabilityError` (or be clearly labelled), never a plausible-looking lie.
- Comments explain **why**, not what. Don't narrate the code.
- Keep public API changes documented in `docs/compatibility-matrix.md`.

## Commit & PR flow

1. Create a branch off `main`.
2. Make your change with tests.
3. Add a changeset describing the user-facing impact:
   ```bash
   pnpm changeset
   ```
4. Ensure `pnpm build && pnpm test && pnpm lint && pnpm typecheck` are green.
5. Open a PR using the template. CI must pass before review.

We use [Changesets](https://github.com/changesets/changesets) for versioning and
publishing — every user-facing change needs one.

## Reporting bugs & requesting features

Use the issue templates. For anything security-related, follow
[`SECURITY.md`](.github/SECURITY.md) instead of opening a public issue.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE) and that you will follow our
[Code of Conduct](CODE_OF_CONDUCT.md).
