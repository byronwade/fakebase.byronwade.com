"use client";

import { useEffect, useState } from "react";

interface EventRow {
  message?: string;
  created_at?: string;
}

/**
 * Subscribes to the /api/realtime SSE bridge and renders incoming events.
 * This is a Client Component — it never imports the (server-only) kernel.
 */
export function RealtimeFeed() {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const source = new EventSource("/api/realtime");
    source.onmessage = (e) => {
      let line = e.data;
      try {
        const row = JSON.parse(e.data) as EventRow;
        line = `${row.created_at ?? ""}  ${row.message ?? e.data}`;
      } catch {
        // keep raw line
      }
      setEvents((prev) => [line, ...prev].slice(0, 50));
    };
    return () => source.close();
  }, []);

  return (
    <div className="feed">
      {events.length === 0 ? (
        <p className="muted">Waiting for events… emit one above.</p>
      ) : (
        events.map((ev, i) => <div key={i}>{ev}</div>)
      )}
    </div>
  );
}
