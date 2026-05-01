import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(__dirname, "drizzle/migrations"),
  );

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "#": path.resolve(__dirname, "src"),
      },
    },
    plugins: [
      cloudflareTest({
        main: "./tests/worker-entry.ts",
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      include: ["tests/**/*.test.ts"],
      setupFiles: ["./tests/setup.ts"],
    },
  };
});
