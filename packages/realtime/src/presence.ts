import type { PresenceState } from "./types.js";

interface PresenceEntry {
  presence_ref: string;
  lastSeen: number;
  [key: string]: unknown;
}

type LeaveListener = (channel: string, ref: string) => void;

const HEARTBEAT_TTL_MS = 30_000;
const SWEEP_INTERVAL_MS = 10_000;

export class PresenceManager {
  private readonly channels = new Map<string, Map<string, PresenceEntry>>();
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly leaveListeners = new Set<LeaveListener>();

  onLeave(listener: LeaveListener): () => void {
    this.leaveListeners.add(listener);
    return () => {
      this.leaveListeners.delete(listener);
    };
  }

  private emitLeave(channel: string, ref: string): void {
    for (const listener of this.leaveListeners) {
      try {
        listener(channel, ref);
      } catch {
        // ignore listener errors
      }
    }
  }

  private ensureChannel(channel: string): Map<string, PresenceEntry> {
    let ch = this.channels.get(channel);
    if (!ch) {
      ch = new Map();
      this.channels.set(channel, ch);
      const timer = setInterval(() => {
        this.sweep(channel);
      }, SWEEP_INTERVAL_MS);
      if (typeof timer === "object" && "unref" in timer) {
        (timer as { unref: () => void }).unref();
      }
      this.timers.set(channel, timer);
    }
    return ch;
  }

  private sweep(channel: string): void {
    const ch = this.channels.get(channel);
    if (!ch) return;
    const now = Date.now();
    for (const [ref, entry] of ch) {
      if (now - entry.lastSeen > HEARTBEAT_TTL_MS) {
        ch.delete(ref);
        this.emitLeave(channel, ref);
      }
    }
  }

  track(channel: string, ref: string, state: Record<string, unknown>): void {
    const ch = this.ensureChannel(channel);
    ch.set(ref, { ...state, presence_ref: ref, lastSeen: Date.now() });
  }

  untrack(channel: string, ref: string): void {
    const ch = this.channels.get(channel);
    if (!ch) return;
    if (ch.has(ref)) {
      ch.delete(ref);
      this.emitLeave(channel, ref);
    }
  }

  heartbeat(channel: string, ref: string): void {
    const ch = this.channels.get(channel);
    const entry = ch?.get(ref);
    if (entry) {
      entry.lastSeen = Date.now();
    }
  }

  getState(channel: string): PresenceState {
    const ch = this.channels.get(channel);
    if (!ch) return {};

    const state: PresenceState = {};
    for (const [ref, entry] of ch) {
      const { lastSeen: _lastSeen, ...rest } = entry;
      const userEntry = rest as { presence_ref: string; [key: string]: unknown };
      const key = ref;
      if (!state[key]) state[key] = [];
      state[key]!.push(userEntry);
    }
    return state;
  }

  cleanup(channel: string): void {
    const timer = this.timers.get(channel);
    if (timer !== undefined) {
      clearInterval(timer);
      this.timers.delete(channel);
    }
    this.channels.delete(channel);
  }
}
