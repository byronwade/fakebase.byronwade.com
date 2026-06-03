import type { EventBus } from "@fakebase/core";
import { BroadcastRegistry } from "./broadcast-registry.js";
import { RealtimeChannel } from "./channel.js";
import { PresenceManager } from "./presence.js";

export class RealtimeService {
  private readonly channels = new Map<string, RealtimeChannel>();
  private readonly presenceManager = new PresenceManager();
  private readonly broadcastRegistry = new BroadcastRegistry();

  constructor(private readonly bus: EventBus) {}

  channel(name: string): RealtimeChannel {
    const existing = this.channels.get(name);
    if (existing) return existing;

    const ch = new RealtimeChannel(
      name,
      this.bus,
      this.presenceManager,
      this.broadcastRegistry,
    );
    this.channels.set(name, ch);
    return ch;
  }

  getChannels(): RealtimeChannel[] {
    return [...this.channels.values()];
  }

  async removeChannel(channel: RealtimeChannel): Promise<"ok" | "error" | "timed out"> {
    const result = await channel.unsubscribe();
    this.channels.delete(channel.getName());
    return result;
  }

  async removeAllChannels(): Promise<("ok" | "error" | "timed out")[]> {
    const results = await Promise.all(
      [...this.channels.values()].map((ch) => ch.unsubscribe()),
    );
    this.channels.clear();
    return results;
  }
}
