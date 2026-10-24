import { defineConfig, lazyPlugins } from "vite-plus";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// #region quickstart:if=vitest
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
// #endregion

const config = defineConfig({
  fmt: {
    printWidth: 80,
    ignorePatterns: [
      // The setup skill edits these with sed / region strips; keep their shape stable.
      ".claude/**",
      "wrangler.jsonc",
      "docs/**",
      "drizzle/migrations/**",
      "public/**",
      "reference/**",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
      "*.md",
    ],
  },
  lint: {
    ignorePatterns: [
      "reference/**",
      "src/routeTree.gen.ts",
      "worker-configuration.d.ts",
    ],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  // #region quickstart:if=vitest
  test: {
    // Scoped to tests/ so the git-ignored reference/ archive is never picked up.
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
  // #endregion
  resolve: { tsconfigPaths: true },
  plugins: lazyPlugins(async () => {
    // #region quickstart:if=vitest
    // Under `vp test` only the Workers test plugin loads, so suites run inside
    // workerd against real D1/KV/DO bindings. Vitest sets process.env.VITEST
    // before it resolves this config.
    if (process.env.VITEST) {
      return [
        cloudflareTest({
          main: "./tests/worker-entry.ts",
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: await readD1Migrations("./drizzle/migrations"),
            },
          },
        }),
      ];
    }
    // #endregion
    return [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart(),
      viteReact(),
      tailwindcss(),
    ];
  }),
});

export default config;
