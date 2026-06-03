# `@fakebase/storage`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The local filesystem storage engine — buckets, objects, and signed URLs written to disk. It mirrors the `supabase.storage` surface and backs the `db.storage` facade.

## Installation

```bash
pnpm add fakebase
```

This package ships with `fakebase` and is published as `@fakebase/storage`.

## Usage

```ts
import { LocalStorageService } from "@fakebase/storage";

const storage = new LocalStorageService(
  ".fakebase/storage",
  new Map(),
  new Map(),
  new Map(),
);

storage.createBucket("avatars");
```

## What's inside

- `LocalStorageService` — bucket/object CRUD, uploads, public + signed URLs, backed by a directory on disk.
- Type `SignedUrlRecord`. Storage value types (`BucketRecord`, `FileObject`, `ObjectRecord`, …) are re-exported from `@fakebase/core`.

Dev-only — "signed" URLs are local tokens, not cryptographically secured cloud URLs.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
