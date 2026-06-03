"use client";

import { useState, useRef, useEffect } from "react";
import {
  Radio,
  Send,
  Users,
  Activity,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types & fixture data
// ---------------------------------------------------------------------------

interface RealtimeEvent {
  id: string;
  channel: string;
  event: string;
  payload: unknown;
  timestamp: string;
}

interface Channel {
  id: string;
  name: string;
  type: "presence" | "broadcast" | "postgres";
  subscribers: number;
  state: "joined" | "leaving" | "closed";
}

interface PresenceState {
  [key: string]: { user_id: string; email: string; online_at: string }[];
}

const INITIAL_CHANNELS: Channel[] = [
  {
    id: "ch-001",
    name: "room:general",
    type: "presence",
    subscribers: 3,
    state: "joined",
  },
  {
    id: "ch-002",
    name: "notifications",
    type: "broadcast",
    subscribers: 5,
    state: "joined",
  },
  { id: "ch-003", name: "public:*", type: "postgres", subscribers: 2, state: "joined" },
];

const INITIAL_EVENTS: RealtimeEvent[] = [
  {
    id: "evt-001",
    channel: "public:*",
    event: "postgres_changes",
    payload: {
      type: "INSERT",
      table: "posts",
      record: { id: "new-post", title: "Hello" },
    },
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: "evt-002",
    channel: "notifications",
    event: "new_message",
    payload: { user: "alice", text: "Hey there" },
    timestamp: new Date(Date.now() - 45000).toISOString(),
  },
  {
    id: "evt-003",
    channel: "room:general",
    event: "presence_sync",
    payload: {
      joins: {
        user_1: { user_id: "u1", email: "alice@example.com", online_at: "now" },
      },
    },
    timestamp: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: "evt-004",
    channel: "public:*",
    event: "postgres_changes",
    payload: { type: "UPDATE", table: "users", record: { id: "u1", role: "admin" } },
    timestamp: new Date(Date.now() - 15000).toISOString(),
  },
];

const INITIAL_PRESENCE: PresenceState = {
  user_1: [
    {
      user_id: "550e8400-e29b-41d4-a716-446655440000",
      email: "alice@example.com",
      online_at: new Date(Date.now() - 300000).toISOString(),
    },
  ],
  user_2: [
    {
      user_id: "550e8400-e29b-41d4-a716-446655440001",
      email: "bob@example.com",
      online_at: new Date(Date.now() - 120000).toISOString(),
    },
  ],
  user_3: [
    {
      user_id: "550e8400-e29b-41d4-a716-446655440002",
      email: "carol@example.com",
      online_at: new Date(Date.now() - 60000).toISOString(),
    },
  ],
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ---------------------------------------------------------------------------
// Event feed (auto-scroll)
// ---------------------------------------------------------------------------

function EventFeed({ events }: { events: RealtimeEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="h-64 overflow-y-auto bg-gray-900 rounded-lg border border-gray-800 p-3 font-mono text-xs space-y-2">
      {events.slice(-50).map((evt) => (
        <div key={evt.id} className="flex gap-3">
          <span className="text-gray-600 flex-shrink-0">{timeAgo(evt.timestamp)}</span>
          <span className="text-blue-400 flex-shrink-0">[{evt.channel}]</span>
          <span className="text-green-400 flex-shrink-0">{evt.event}</span>
          <span className="text-gray-400 break-all">{JSON.stringify(evt.payload)}</span>
        </div>
      ))}
      {events.length === 0 && (
        <p className="text-gray-600 text-center py-8">No events yet</p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RealtimePage() {
  const [channels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [events, setEvents] = useState<RealtimeEvent[]>(INITIAL_EVENTS);
  const [expandedChannel, setExpandedChannel] = useState<string | null>("room:general");
  const [broadcastChannel, setBroadcastChannel] = useState("notifications");
  const [broadcastEvent, setBroadcastEvent] = useState("my_event");
  const [broadcastPayload, setBroadcastPayload] = useState('{"key": "value"}');
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [expandedPresence, setExpandedPresence] = useState(false);

  function handleBroadcast() {
    try {
      const parsed: unknown = JSON.parse(broadcastPayload);
      setPayloadError(null);
      const newEvent: RealtimeEvent = {
        id: `evt-${Date.now()}`,
        channel: broadcastChannel,
        event: broadcastEvent,
        payload: parsed,
        timestamp: new Date().toISOString(),
      };
      setEvents((e) => [...e, newEvent]);
    } catch {
      setPayloadError("Invalid JSON payload");
    }
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white">Realtime Inspector</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          <span className="text-xs font-mono bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
            DEV-ONLY
          </span>{" "}
          In-process pub/sub — not real Supabase Realtime WebSocket
        </p>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* Channel list */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Radio className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Channels</h2>
            <span className="text-xs text-gray-600 font-mono">
              ({channels.length} active)
            </span>
          </div>
          <div className="space-y-2">
            {channels.map((ch) => (
              <div
                key={ch.id}
                className="border border-gray-800 rounded-lg overflow-hidden"
              >
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
                  onClick={() =>
                    setExpandedChannel((e) => (e === ch.name ? null : ch.name))
                  }
                >
                  {expandedChannel === ch.name ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-mono text-white">{ch.name}</span>
                    <span className="ml-2 text-xs text-gray-500">({ch.type})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="h-3.5 w-3.5" />
                      {ch.subscribers}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${ch.state === "joined" ? "text-green-400 bg-green-500/10" : "text-yellow-400 bg-yellow-500/10"}`}
                    >
                      {ch.state}
                    </span>
                  </div>
                </button>
                {expandedChannel === ch.name && (
                  <div className="border-t border-gray-800 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-2">
                      Recent events on this channel:
                    </p>
                    <div className="space-y-1">
                      {events
                        .filter((e) => e.channel === ch.name)
                        .slice(-5)
                        .map((evt) => (
                          <div key={evt.id} className="flex gap-2 text-xs font-mono">
                            <span className="text-gray-600">
                              {timeAgo(evt.timestamp)}
                            </span>
                            <span className="text-green-400">{evt.event}</span>
                            <span className="text-gray-500 truncate">
                              {JSON.stringify(evt.payload).slice(0, 60)}
                            </span>
                          </div>
                        ))}
                      {events.filter((e) => e.channel === ch.name).length === 0 && (
                        <p className="text-xs text-gray-700">
                          No events on this channel yet.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Broadcast panel */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Send className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Broadcast</h2>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Channel
                </label>
                <select
                  value={broadcastChannel}
                  onChange={(e) => setBroadcastChannel(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.name}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  Event Name
                </label>
                <input
                  type="text"
                  value={broadcastEvent}
                  onChange={(e) => setBroadcastEvent(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                  placeholder="my_event"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                JSON Payload
              </label>
              <textarea
                value={broadcastPayload}
                onChange={(e) => {
                  setBroadcastPayload(e.target.value);
                  setPayloadError(null);
                }}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500 resize-none"
                placeholder='{"key": "value"}'
              />
              {payloadError && (
                <p className="text-xs text-red-400 mt-1">{payloadError}</p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleBroadcast}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                <Send className="h-4 w-4" /> Broadcast
              </button>
            </div>
          </div>
        </section>

        {/* Event feed */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">
              Postgres Changes Stream
            </h2>
            <span className="flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </div>
          <EventFeed events={events} />
        </section>

        {/* Presence */}
        <section>
          <button
            className="flex items-center gap-2 mb-4 w-full text-left"
            onClick={() => setExpandedPresence((e) => !e)}
          >
            {expandedPresence ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            <Users className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-300">Presence State</h2>
            <span className="text-xs text-gray-600 font-mono">
              ({Object.keys(INITIAL_PRESENCE).length} online)
            </span>
          </button>
          {expandedPresence && (
            <div className="space-y-2">
              {Object.entries(INITIAL_PRESENCE).map(([key, presences]) => (
                <div
                  key={key}
                  className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm font-mono text-gray-300">{key}</span>
                  </div>
                  {presences.map((p, i) => (
                    <div key={i} className="text-xs text-gray-500 font-mono pl-4">
                      <span className="text-gray-400">{p.email}</span>
                      <span className="text-gray-600 ml-2">— online </span>
                      <span className="text-gray-600">
                        <Clock className="h-2.5 w-2.5 inline" /> {timeAgo(p.online_at)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
