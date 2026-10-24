// Auth + D1 migration test.
// We test at the D1 layer directly rather than importing createAuth
// because createAuth pulls in resend → svix (CJS-only), which the Workers
// runtime does not support as a static module import.
// The test proves:
//   1. Migrations were applied (all auth tables exist in the test D1)
//   2. We can INSERT and SELECT a user row directly — the same thing
//      better-auth's signUpEmail does internally

/// <reference types="@cloudflare/vitest-plugin/types" />
import { describe, it, expect } from "vite-plus/test";
import { env } from "cloudflare:workers";

describe("D1 migrations + auth schema", () => {
  it("users table exists and accepts a row", async () => {
    // The migrations are applied in tests/setup.ts via applyD1Migrations.
    // If the table doesn't exist, the prepare().run() below throws.
    const id = crypto.randomUUID();
    const email = `vitest-${id.slice(0, 8)}@example.com`;
    const now = Date.now();
    await env.DB.prepare(
      `INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, "Vitest User", email, 0, now, now)
      .run();

    const row = await env.DB.prepare("SELECT email FROM users WHERE email = ?")
      .bind(email)
      .first<{ email: string }>();

    expect(row?.email).toBe(email);
  });

  it("all required auth tables exist (sessions, accounts, verifications)", async () => {
    // Each prepare() call will throw if the table doesn't exist.
    const tables = [
      "users",
      "sessions",
      "accounts",
      "verifications",
      // #region quickstart:if=org
      "organizations",
      "members",
      "invitations",
      // #endregion
    ];
    for (const table of tables) {
      const result = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM ${table}`,
      ).first<{
        count: number;
      }>();
      expect(typeof result?.count).toBe("number");
    }
  });
});
