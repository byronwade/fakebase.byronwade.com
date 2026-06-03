# Security Policy

## Scope: this is a dev-only tool

Fakebase is a **local/development-only** Supabase-shaped platform for
prototypes. It is **not** designed to protect real users, secrets, or data, and
must never be deployed as production infrastructure. Its auth, RLS, and
`service_role` behaviours are approximations — see
[`docs/security.md`](../docs/security.md) for the full threat model and the list
of things you must verify against real Supabase before shipping.

Because of this, "vulnerabilities" in the runtime security model (e.g. RLS not
matching Postgres exactly) are **documented limitations**, not security bugs.

## What we _do_ treat as a vulnerability

We take the following seriously and want reports for them:

- Code execution or path-traversal triggered by the CLI, codegen, or adapters
  while operating on a developer's machine.
- A supply-chain issue in a published `fakebase` / `@fakebase/*` package.
- Anything that could harm a developer running Fakebase locally as intended.

## Reporting

Please **do not** open a public issue for a suspected vulnerability.

1. Use GitHub's [private vulnerability reporting](https://github.com/byronwade/fakebase/security/advisories/new)
   ("Report a vulnerability" under the Security tab), **or**
2. Email **security@fakebase.dev** with a description and reproduction steps.

We aim to acknowledge reports within 5 business days and to provide a remediation
timeline after triage. Coordinated disclosure is appreciated.

## Supported versions

Fakebase is pre-1.0; security fixes are released against the latest published
version only.
