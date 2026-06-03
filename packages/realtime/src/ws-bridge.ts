import type { BroadcastPayload } from "./types.js";

const DEFAULT_PORT = 4001;

export interface WsBridgeServer {
  port: number;
  broadcast(payload: BroadcastPayload): void;
  close(): void;
}

class NoopWsBridgeServer implements WsBridgeServer {
  readonly port: number;
  constructor(port: number) {
    this.port = port;
  }
  broadcast(_payload: BroadcastPayload): void {}
  close(): void {}
}

class ActiveWsBridgeServer implements WsBridgeServer {
  readonly port: number;
  private readonly wss: any;
  private readonly clients = new Set<any>();

  constructor(port: number, WsServer: any) {
    this.port = port;
    this.wss = new WsServer({ port });
    this.wss.on(
      "connection",
      (ws: { on: (event: string, cb: () => void) => void; close: () => void }) => {
        this.clients.add(ws);
        ws.on("close", () => {
          this.clients.delete(ws);
        });
      },
    );
    this.wss.on("error", (err: Error) => {
      console.warn("[fakebase/realtime] WsBridgeServer error:", err.message);
    });
  }

  broadcast(payload: BroadcastPayload): void {
    const data = JSON.stringify(payload);
    for (const client of this.clients) {
      try {
        client.send(data);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  close(): void {
    for (const client of this.clients) {
      try {
        client.close();
      } catch {
        // ignore
      }
    }
    this.clients.clear();
    this.wss.close();
  }
}

export function createWsBridge(port: number = DEFAULT_PORT): WsBridgeServer {
  try {
    // Dynamic require so bundlers don't fail when ws is absent
    const ws = require("ws") as { Server: new (opts: { port: number }) => unknown };
    return new ActiveWsBridgeServer(port, ws.Server);
  } catch {
    console.warn(
      "[fakebase/realtime] Optional dependency 'ws' is not installed — WsBridgeServer is a no-op. " +
        "Run `pnpm add ws` to enable multi-tab broadcast bridging.",
    );
    return new NoopWsBridgeServer(port);
  }
}
