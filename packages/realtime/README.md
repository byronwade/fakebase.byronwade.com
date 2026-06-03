# `@byronwade/realtime`

> Part of [**Fakebase**](https://github.com/byronwade/fakebase) — a Supabase-shaped, **local/dev-only** development platform for Next.js prototypes. Not for production use.

The realtime engine — broadcast, presence, and postgres-changes channels, plus an optional local WebSocket bridge. It mirrors `supabase.channel(...)` semantics for local dev.

## Installation

```bash
pnpm add @byronwade/realtime
```

When you use `fakebase`, realtime is also reachable through the client as `db.channel(...)`. Install this package directly to use the engine standalone.

## Usage

```ts
import { EventBus } from "@byronwade/core";
import { RealtimeService } from "@byronwade/realtime";

const realtime = new RealtimeService(new EventBus());
const channel = realtime.channel("room-1");
```

## What's inside

- `RealtimeService` — manages channels over an `EventBus`.
- `RealtimeChannel`, `PresenceManager`, `BroadcastRegistry` — the building blocks for broadcast/presence/changes.
- `createWsBridge(port?)` — an optional local WebSocket server (+ type `WsBridgeServer`).

The WebSocket bridge needs the optional `ws` dependency. Dev-only.

## Documentation

- [Project README](https://github.com/byronwade/fakebase#readme)
- [Architecture](https://github.com/byronwade/fakebase/blob/main/docs/architecture.md)
- [Compatibility matrix](https://github.com/byronwade/fakebase/blob/main/docs/compatibility-matrix.md)

## License

MIT
