# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

Add a changeset describing your change with:

```bash
pnpm changeset
```

Each changeset is a markdown file noting which packages changed and at what
semver level. They are consumed by `pnpm version-packages` and `pnpm release`.
