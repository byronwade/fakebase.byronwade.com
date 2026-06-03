/**
 * Auth value types.
 *
 * The canonical definitions live in `@fakebase/core` so the kernel and the
 * client auth facade share one contract. They are re-exported here under the
 * `Local*` names used throughout `@fakebase/auth`.
 */

export type {
  AuthUser as LocalUser,
  AuthSession as LocalSession,
  AuthChangeEvent,
  OtpRecord,
  SessionStorageAdapter,
} from "@fakebase/core";

import type { AuthChangeEvent, AuthSession } from "@fakebase/core";

/** Payload shape passed to internal auth-state listeners. */
export interface AuthStateChangeEvent {
  event: AuthChangeEvent;
  session: AuthSession | null;
}
