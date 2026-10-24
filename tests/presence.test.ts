/// <reference types="@cloudflare/vitest-plugin/types" />
import { describe, it, expect } from "vite-plus/test";
import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { PresenceDO } from "../src/server/presence-do";

describe("PresenceDO", () => {
  it("instantiates correctly", async () => {
    const id = env.PRESENCE.idFromName("test-instance");
    const stub = env.PRESENCE.get(id);

    await runInDurableObject(
      stub,
      async (instance: PresenceDO, _state: DurableObjectState) => {
        expect(instance).toBeInstanceOf(PresenceDO);
      },
    );
  });

  it("returns empty members list initially via /list endpoint", async () => {
    const id = env.PRESENCE.idFromName("test-list");
    const stub = env.PRESENCE.get(id);
    const res = await stub.fetch("https://example.com/list");
    expect(res.status).toBe(200);
    const body = await res.json<{
      members: Array<{ id: string; name: string; lastSeen: number }>;
    }>();
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.members.length).toBe(0);
  });
});
