import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/client";

type Member = { id: string; name: string; lastSeen: number };

export function PresenceWidget() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [connected, setConnected] = useState(false);

  // No reconnect logic — Stage 3 should add exponential backoff if needed.
  useEffect(() => {
    if (!session?.user) return;

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${location.host}/api/presence/ws`);

    let heartbeat: ReturnType<typeof setInterval> | undefined;

    const sendPing = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ id: session.user.id, name: session.user.name }));
      }
    };

    ws.addEventListener("open", () => {
      setConnected(true);
      sendPing();
      heartbeat = setInterval(sendPing, 10_000);
    });

    ws.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data) as { members: Member[] };
        setMembers(data.members);
      } catch {
        // ignore
      }
    });

    ws.addEventListener("close", () => {
      setConnected(false);
      if (heartbeat) clearInterval(heartbeat);
    });

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      ws.close();
    };
  }, [session?.user?.id, session?.user?.name]);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Online now</h3>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`} />
      </div>
      {!connected ? (
        <p className="mt-2 text-sm text-muted-foreground">Connecting…</p>
      ) : members.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Just you (so far).</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {members.map((m) => (
            <li key={m.id}>{m.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
