/**
 * Auth value types.
 *
 * The canonical definitions live in `@byronwade/core` so the kernel and the
 * client auth facade share one contract. They are re-exported here under the
 * `Local*` names used throughout `@byronwade/auth`.
 */

export type {
  AuthUser as LocalUser,
  AuthSession as LocalSession,
  AuthChangeEvent,
  OtpRecord,
  SessionStorageAdapter,
} from "@byronwade/core";

import type { AuthChangeEvent, AuthSession } from "@byronwade/core";

/** Payload shape passed to internal auth-state listeners. */
export interface AuthStateChangeEvent {
  event: AuthChangeEvent;
  session: AuthSession | null;
}
