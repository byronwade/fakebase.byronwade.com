/**
 * In-process event bus.
 *
 * Emulates the Supabase Realtime change-feed locally. Adapters publish events
 * after every mutating operation; callers subscribe to receive them.
 */
/**
 * Simple synchronous pub/sub bus for Fakebase row-change events.
 * Subscriptions are synchronous — handlers run inline during `publish`.
 */
export class EventBus {
    handlers = new Set();
    /**
     * Subscribe to all row-change events.
     * @returns A function that removes this subscription when called.
     */
    subscribe(handler) {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }
    /** Emit an event to all current subscribers. */
    publish(event) {
        for (const handler of this.handlers) {
            try {
                handler(event);
            }
            catch (err) {
                // Subscriber errors must not interrupt the operation that emitted the event
                console.error("[fakebase/events] Subscriber threw an error:", err);
            }
        }
    }
    /** Remove all subscribers. Useful for test teardown. */
    clear() {
        this.handlers.clear();
    }
}
//# sourceMappingURL=bus.js.map