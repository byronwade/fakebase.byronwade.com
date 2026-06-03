/**
 * In-process event bus.
 *
 * Emulates the Supabase Realtime change-feed locally. Adapters publish events
 * after every mutating operation; callers subscribe to receive them.
 */

/** A single row change event emitted after a successful DML operation. */
export interface FakebaseEvent {
  type: "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  record: Record<string, unknown>;
  oldRecord?: Record<string, unknown>;
  /** ISO 8601 timestamp of the commit. */
  commitTimestamp: string;
}

/** Handler function type for event subscribers. */
export type EventHandler = (event: FakebaseEvent) => void;

/**
 * Simple synchronous pub/sub bus for Fakebase row-change events.
 * Subscriptions are synchronous — handlers run inline during `publish`.
 */
export class EventBus {
  private readonly handlers = new Set<EventHandler>();

  /**
   * Subscribe to all row-change events.
   * @returns A function that removes this subscription when called.
   */
  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Emit an event to all current subscribers. */
  publish(event: FakebaseEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        // Subscriber errors must not interrupt the operation that emitted the event
        console.error("[fakebase/events] Subscriber threw an error:", err);
      }
    }
  }

  /** Remove all subscribers. Useful for test teardown. */
  clear(): void {
    this.handlers.clear();
  }
}
