/**
 * Realtime client facade — provides the `supabase.channel()` surface
 * on top of the kernel's minimal `RealtimeEngine` pub/sub interface.
 */
/**
 * A realtime channel — mirrors `supabase.channel(name)`.
 */
export class Channel {
    name;
    topic;
    engine;
    unsubs = [];
    status = "CLOSED";
    broadcastListeners = new Map();
    presenceListeners = new Map();
    constructor(name, engine) {
        this.name = name;
        this.topic = `realtime:${name}`;
        this.engine = engine;
    }
    on(type, filter, callback) {
        if (type === "postgres_changes") {
            const pgFilter = filter;
            const schema = pgFilter.schema ?? "public";
            const table = pgFilter.table ?? "*";
            const events = pgFilter.event === "*"
                ? ["INSERT", "UPDATE", "DELETE"]
                : [pgFilter.event];
            for (const ev of events) {
                const unsub = this.engine.subscribe(schema, table, ev, callback);
                this.unsubs.push(unsub);
            }
        }
        else if (type === "broadcast") {
            const broadcastFilter = filter;
            const key = broadcastFilter.event;
            if (!this.broadcastListeners.has(key)) {
                this.broadcastListeners.set(key, new Set());
            }
            this.broadcastListeners.get(key).add(callback);
        }
        else if (type === "presence") {
            const presenceFilter = filter;
            const key = presenceFilter.event;
            if (!this.presenceListeners.has(key)) {
                this.presenceListeners.set(key, new Set());
            }
            this.presenceListeners.get(key).add(callback);
        }
        return this;
    }
    /**
     * Activate the channel subscriptions.
     *
     * @param callback - Optional status callback invoked when subscription state changes.
     */
    subscribe(callback) {
        this.status = "SUBSCRIBED";
        queueMicrotask(() => callback?.("SUBSCRIBED"));
        return this;
    }
    /** Deactivate the channel, removing all kernel subscriptions. */
    async unsubscribe() {
        for (const unsub of this.unsubs)
            unsub();
        this.unsubs.length = 0;
        this.status = "CLOSED";
        return "ok";
    }
    /**
     * Broadcast a message on this channel.
     *
     * In the memory kernel, broadcast listeners registered on the same channel
     * object are called synchronously. Remote broadcast (across processes) is
     * not supported by the in-memory adapter.
     */
    async send(payload) {
        if (payload.type === "broadcast") {
            const cbs = this.broadcastListeners.get(payload.event);
            if (cbs) {
                for (const cb of cbs) {
                    cb({
                        type: payload.type,
                        event: payload.event,
                        payload: payload.payload ?? {},
                    });
                }
            }
        }
        return "ok";
    }
    /** Current subscription status. */
    getStatus() {
        return this.status;
    }
}
/**
 * Build the `supabase.realtime` / `supabase.channel()` facade object.
 *
 * @param kernel - The kernel whose realtime engine to wrap.
 */
export function createRealtimeClient(kernel) {
    const engine = kernel.realtime;
    const channels = new Map();
    return {
        channel(name, _options) {
            if (!channels.has(name)) {
                channels.set(name, new Channel(name, engine));
            }
            return channels.get(name);
        },
        getChannels() {
            return [...channels.values()];
        },
        async removeChannel(channel) {
            const result = await channel.unsubscribe();
            channels.delete(channel.name);
            return result;
        },
        async removeAllChannels() {
            const results = [];
            for (const ch of channels.values()) {
                results.push(await ch.unsubscribe());
            }
            channels.clear();
            return results;
        },
    };
}
//# sourceMappingURL=realtime-client.js.map