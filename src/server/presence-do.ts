import { DurableObject } from "cloudflare:workers";

interface Member {
  id: string;
  name: string;
  lastSeen: number;
}

export class PresenceDO extends DurableObject {
  private members = new Map<string, Member>();
  private sockets = new Set<WebSocket>();

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("/ws")) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      this.handleSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname.endsWith("/list")) {
      this.gc();
      return Response.json({ members: [...this.members.values()] });
    }

    return new Response("Not found", { status: 404 });
  }

  private handleSocket(ws: WebSocket) {
    ws.accept();
    this.sockets.add(ws);
    ws.addEventListener("message", (e) => {
      try {
        const msg = JSON.parse(e.data as string) as {
          id: string;
          name: string;
        };
        if (!msg.id || !msg.name) return;
        this.members.set(msg.id, {
          id: msg.id,
          name: msg.name,
          lastSeen: Date.now(),
        });
        this.broadcast();
      } catch {
        // ignore malformed messages
      }
    });
    ws.addEventListener("close", () => {
      this.sockets.delete(ws);
    });
    ws.addEventListener("error", () => {
      this.sockets.delete(ws);
    });
  }

  private gc() {
    const cutoff = Date.now() - 30_000;
    for (const [k, v] of this.members) {
      if (v.lastSeen < cutoff) this.members.delete(k);
    }
  }

  private broadcast() {
    this.gc();
    const payload = JSON.stringify({ members: [...this.members.values()] });
    for (const ws of this.sockets) {
      try {
        ws.send(payload);
      } catch {
        this.sockets.delete(ws);
      }
    }
  }
}
