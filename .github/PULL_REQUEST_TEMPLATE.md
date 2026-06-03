<!-- Thanks for contributing to Fakebase! -->

## Summary

<!-- What does this change and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Docs / chore

## Checklist

- [ ] `pnpm build && pnpm test && pnpm lint && pnpm typecheck` pass locally
- [ ] Added/updated tests (and the cross-adapter contract suite if a backend changed)
- [ ] Added a changeset (`pnpm changeset`) for any user-facing change
- [ ] Updated docs (`docs/compatibility-matrix.md` if the supported API surface changed)
- [ ] Unsupported Supabase surface still returns a structured `CapabilityError` (no silent fakes)
- [ ] Preserved the dev-only contract (nothing here implies production readiness)

## Notes for reviewers

<!-- Anything that needs special attention, screenshots for admin UI changes, etc. -->
