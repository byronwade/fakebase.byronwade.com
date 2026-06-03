export type RealtimeChannelStatus =
  | "SUBSCRIBED"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR";

export interface PostgresChangesPayload {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  errors: null | string[];
}

export interface BroadcastPayload {
  type: "broadcast";
  event: string;
  payload: Record<string, unknown>;
}

export interface PresenceState {
  [key: string]: { presence_ref: string; [key: string]: unknown }[];
}

export interface PresenceSyncPayload {
  type: "presence";
  event: "sync" | "join" | "leave";
  payload: { joins: PresenceState; leaves: PresenceState };
}

export type PostgresChangesFilter = {
  event: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table?: string;
  filter?: string;
};

export interface ChannelBinding {
  type: "postgres_changes" | "broadcast" | "presence";
  filter?: PostgresChangesFilter | Record<string, unknown>;
  callback: (
    payload: PostgresChangesPayload | BroadcastPayload | PresenceSyncPayload,
  ) => void;
}
