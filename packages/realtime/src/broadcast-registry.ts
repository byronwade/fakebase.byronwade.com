import type { BroadcastPayload } from "./types.js";

type BroadcastHandler = (payload: BroadcastPayload) => void;

/**
 * In-process registry that routes broadcast messages between all
 * subscribers of a given channel name.
 */
export class BroadcastRegistry {
  private readonly subscribers = new Map<string, Set<BroadcastHandler>>();

  subscribe(channelName: string, handler: BroadcastHandler): () => void {
    let subs = this.subscribers.get(channelName);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(channelName, subs);
    }
    subs.add(handler);
    return () => {
      subs!.delete(handler);
      if (subs!.size === 0) {
        this.subscribers.delete(channelName);
      }
    };
  }

  /**
   * Emit a broadcast message to all handlers of a channel EXCEPT the sender.
   */
  publish(
    channelName: string,
    payload: BroadcastPayload,
    sender: BroadcastHandler,
  ): void {
    const subs = this.subscribers.get(channelName);
    if (!subs) return;
    for (const handler of subs) {
      if (handler === sender) continue;
      try {
        handler(payload);
      } catch {
        // ignore subscriber errors
      }
    }
  }
}
