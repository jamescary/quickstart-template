// Apply D1 migrations once before all tests.
// applyD1Migrations runs outside isolated storage, so migrations persist
// across all tests in the suite (each test still gets isolated *writes*).
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

// TEST_MIGRATIONS is injected via vitest.config.ts miniflare.bindings at test time only.
const testEnv = env as typeof env & { TEST_MIGRATIONS: D1Migration[] };
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS);
