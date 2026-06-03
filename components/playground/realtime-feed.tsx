"use client";

import * as React from "react";
import { Plus, Radio } from "lucide-react";
import { realtimeInsertAction } from "@/app/playground/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";

type ChangeEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  commit_timestamp: string;
};

const TONE: Record<ChangeEvent["eventType"], "success" | "info" | "danger"> = {
  INSERT: "success",
  UPDATE: "info",
  DELETE: "danger",
};

const BADGE: Record<ChangeEvent["eventType"], "success" | "secondary" | "destructive"> = {
  INSERT: "success",
  UPDATE: "secondary",
  DELETE: "destructive",
};

/**
 * Live view of the kernel's realtime bus. Opens an `EventSource` to the SSE
 * route, which forwards every `postgres_changes` event from the visitor's kernel.
 * The "Insert a row" button fires a Server Action whose insert streams straight
 * back into this feed — the same in-process bus, bridged to the browser.
 */
export function RealtimeFeed() {
  const [events, setEvents] = React.useState<ChangeEvent[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    const es = new EventSource("/playground/realtime/stream");
    es.addEventListener("ready", () => setConnected(true));
    es.addEventListener("change", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as ChangeEvent;
        setEvents((prev) => [data, ...prev].slice(0, 50));
      } catch {
        /* ignore malformed frame */
      }
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <StatusDot tone={connected ? "success" : "neutral"} pulse={connected} />
          <span className="text-muted-foreground">
            {connected ? "Subscribed to" : "Connecting to"}{" "}
            <code className="font-mono text-foreground">postgres_changes</code>
          </span>
        </div>
        <form action={realtimeInsertAction}>
          <Button type="submit" size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Insert a row
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          <Radio className="size-3.5" />
          live event stream
          <span className="ml-auto tabular-nums">{events.length}</span>
        </div>
        {events.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No events yet. Insert a row above (or mutate any table) to watch changes
            stream in.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {events.map((ev, i) => {
              const row = ev.new ?? ev.old ?? {};
              const id = String((row as { id?: unknown }).id ?? "");
              return (
                <li
                  key={`${ev.commit_timestamp}-${id}-${i}`}
                  className="flex items-start gap-3 px-3 py-2.5"
                >
                  <Badge variant={BADGE[ev.eventType]} className="mt-0.5 shrink-0">
                    {ev.eventType}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[13px]">
                      <code className="font-mono text-foreground">
                        public.{ev.table}
                      </code>
                      <span className="truncate text-muted-foreground">
                        {previewRow(row)}
                      </span>
                    </div>
                  </div>
                  <time className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
                    {formatTime(ev.commit_timestamp)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function previewRow(row: Record<string, unknown>): string {
  const title = row.title ?? row.username ?? row.email ?? row.body ?? row.id;
  return typeof title === "string" ? title : JSON.stringify(title);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString(undefined, { hour12: false });
}
