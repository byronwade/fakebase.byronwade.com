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
export declare class EventBus {
    private readonly handlers;
    /**
     * Subscribe to all row-change events.
     * @returns A function that removes this subscription when called.
     */
    subscribe(handler: EventHandler): () => void;
    /** Emit an event to all current subscribers. */
    publish(event: FakebaseEvent): void;
    /** Remove all subscribers. Useful for test teardown. */
    clear(): void;
}
//# sourceMappingURL=bus.d.ts.map