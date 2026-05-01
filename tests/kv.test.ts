/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";

describe("KV bindings", () => {
  it("stores and retrieves a value", async () => {
    await env.KV.put("smoke-key", "hello");
    const v = await env.KV.get("smoke-key");
    expect(v).toBe("hello");
  });

  it("returns null for missing keys", async () => {
    const v = await env.KV.get("definitely-not-a-key");
    expect(v).toBeNull();
  });
});
