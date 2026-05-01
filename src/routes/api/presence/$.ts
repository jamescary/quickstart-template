import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

export const Route = createFileRoute("/api/presence/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = env.PRESENCE.idFromName("global");
        const stub = env.PRESENCE.get(id);
        return stub.fetch(request);
      },
    },
  },
});
