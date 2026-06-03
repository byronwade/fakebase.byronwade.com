/**
 * Realtime engine contract + the default in-process implementation.
 *
 * The kernel emits Postgres-change events from its mutation commit pipeline;
 * the client realtime facade subscribes to those events to drive
 * `postgres_changes` channel callbacks. Broadcast and presence are layered on
 * top in the client channel (and in `@fakebase/realtime` for the richer
 * cross-process bridge).
 */
/**
 * Default realtime engine — wraps a {@link EventBus}. Subscribing registers a
 * filtered bus listener; emitting publishes a {@link FakebaseEvent}, so both
 * this engine's subscribers and any raw bus subscribers (e.g.
 * `@fakebase/realtime`'s `RealtimeService`) receive the change.
 */
export class InProcessRealtimeEngine {
    bus;
    constructor(bus) {
        this.bus = bus;
    }
    subscribe(schema, table, event, callback) {
        return this.bus.subscribe((ev) => {
            if (ev.schema !== schema)
                return;
            if (table !== "*" && ev.table !== table)
                return;
            if (ev.type !== event)
                return;
            callback({
                schema: ev.schema,
                table: ev.table,
                commit_timestamp: ev.commitTimestamp,
                eventType: ev.type,
                new: ev.type !== "DELETE" ? ev.record : {},
                old: ev.oldRecord ?? (ev.type === "DELETE" ? ev.record : {}),
                errors: null,
            });
        });
    }
    emit(change) {
        this.bus.publish({
            type: change.eventType,
            schema: change.schema,
            table: change.table,
            record: change.eventType === "DELETE" ? change.old : change.new,
            oldRecord: change.old,
            commitTimestamp: new Date().toISOString(),
        });
    }
}
//# sourceMappingURL=realtime.js.map