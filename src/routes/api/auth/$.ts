import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { createAuth, type AuthEnv } from "@/lib/auth/server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const cf = (request as any).cf;
  const auth = createAuth(env as unknown as AuthEnv, cf);
  return auth.handler(request);
}
