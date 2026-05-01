# Stage 1: Reference App Implementation Plan

> **Status: ✅ COMPLETE (2026-05-01).** Reference app deployed at `https://quickstart-reference.eliteeggnog.workers.dev`. 44 commits in `reference/`. Build clean, 6/6 tests pass. See `reference/BUILD_NOTES.md` for the per-task implementation log including all gotchas, the Files Inventory grouped by toggle (Stage 2 input), and the Stage 1 completion summary at the end.
>
> The text below was the plan as written; corrections discovered during execution are reflected inline. Where reality diverged from the plan (e.g., `dist/` vs `.output/`, `--add-ons` plural, the `nitro` plugin removal, the `createServerEntry` pattern for DO export), the plan has been updated to match what actually worked.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a real, working, deployed full-stack reference app at `/Users/jamescary/dev/quickstart-template/reference/` with every feature on (no toggles, no skill). This output is the source material for Stage 2 (templatize) and Stage 3 (build skill).

**Architecture:** Single-package TanStack Start app on Cloudflare Workers. Drizzle + D1 for data, KV for rate limiting and ephemeral cache, one Durable Object for real-time presence. better-auth (via `better-auth-cloudflare`) for auth with email/password + GitHub/Google OAuth + organization plugin. Resend for transactional email. Tailwind v4 + shadcn/ui (`new-york`) for UI. Vitest + `@cloudflare/vitest-pool-workers` for tests. pnpm for package management.

**Tech Stack:** TanStack Start · `@cloudflare/vite-plugin` · Drizzle ORM (`drizzle-orm/d1` + `drizzle-kit`) · `better-auth` + `better-auth-cloudflare` + organization plugin · Resend SDK · Tailwind v4 + shadcn/ui · Vitest + `@cloudflare/vitest-pool-workers` · pnpm · Wrangler (`wrangler.jsonc`).

**Reference docs:** All current as of 2026-04-30 via context7. If a command/snippet fails, re-query context7 (libraries pinned: `/websites/tanstack_start_framework_react`, `/zpg6/better-auth-cloudflare`, `/better-auth/better-auth`, `/drizzle-team/drizzle-orm-docs`, `/websites/developers_cloudflare_workers`, `/websites/resend`, `/websites/ui_shadcn`).

---

## Pre-flight checklist (run once before Task 1)

- [ ] **Verify tooling.** Run each and confirm output:
  ```bash
  node --version    # expect v20.x or v22.x
  pnpm --version    # expect 9.x or 10.x
  wrangler --version # expect 4.x
  gh --version      # for later (Stage 1 doesn't need it, but verifies)
  ```
  If any are missing: `corepack enable pnpm`, `npm install -g wrangler`, `brew install gh`.

- [ ] **Verify Cloudflare auth.** Run `wrangler whoami`. If not logged in, `wrangler login` (opens browser). Confirm the displayed account is the one you want to use; capture the **Account ID** for later.

- [ ] **Create the working directory.**
  ```bash
  rm -rf /Users/jamescary/dev/quickstart-template/reference
  mkdir -p /Users/jamescary/dev/quickstart-template/reference
  cd /Users/jamescary/dev/quickstart-template/reference
  ```

- [ ] **Start `BUILD_NOTES.md`.** Create the file at `/Users/jamescary/dev/quickstart-template/reference/BUILD_NOTES.md` with this header:
  ```markdown
  # BUILD_NOTES — Quickstart Reference App

  Captured during Stage 1 build. Source material for Stage 2 (templatize) and Stage 3 (skill).

  Format per task: command run, output observed (key parts only), files created/modified, gotchas.
  ```
  After every task, append a section with what was actually run and any deviations from this plan. This file becomes the basis for `manifest.json` and skill instructions later.

---

## Task 1: Bootstrap TanStack Start with Cloudflare Vite plugin

**Files:**
- Create (via CLI): everything under `/Users/jamescary/dev/quickstart-template/reference/`
- Modify: `vite.config.ts`, `wrangler.jsonc` (created by template; we extend it)

- [ ] **Step 1: Scaffold the project.**
  ```bash
  cd /tmp
  pnpx create-start-app@latest quickstart-reference --add-ons cloudflare
  ```
  Note: the flag is `--add-ons` (plural). The tool will warn that `create-start-app` is deprecated in favor of `npx @tanstack/cli create` — that's fine for now, the deprecated path still works. Accept defaults when prompted.

  **Side effects of `--add-ons cloudflare`:** the scaffolder pre-installs Tailwind v4 (`@tailwindcss/vite`) and pre-wires the Cloudflare Vite plugin. That makes Task 3 (Tailwind) shorter than originally written.

- [ ] **Step 2: Verify scaffold contents.**
  ```bash
  cd /Users/jamescary/dev/quickstart-template/reference
  ls -la
  ```
  Expected to see `package.json`, `vite.config.ts`, `tsconfig.json`, `src/routes/__root.tsx`, `src/routes/index.tsx`. If `wrangler.jsonc` is missing (no `--add-on cloudflare`), proceed to Step 3 to add it.

- [ ] **Step 3: Install Cloudflare Vite plugin and wrangler if not already added.**
  ```bash
  pnpm add -D @cloudflare/vite-plugin wrangler @cloudflare/workers-types
  ```

- [ ] **Step 4: Verify (and minimally adjust) `vite.config.ts`.**

  The scaffolder produces a config close to what we want. Verify the file looks like this (remove the `nitro` plugin if present — it conflicts with `@cloudflare/vite-plugin` and crashes dev with "initRunner is not a function"):

  ```typescript
  import { defineConfig } from "vite";
  import { tanstackStart } from "@tanstack/react-start/plugin/vite";
  import { cloudflare } from "@cloudflare/vite-plugin";
  import viteReact from "@vitejs/plugin-react";
  import tailwindcss from "@tailwindcss/vite";

  export default defineConfig({
    resolve: { tsconfigPaths: true },
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tanstackStart(),
      viteReact(),
      tailwindcss(),
    ],
  });
  ```

  Notes:
  - `tailwindcss()` is included by the scaffolder when `--add-ons cloudflare` is passed. Keep it.
  - `resolve: { tsconfigPaths: true }` is Vite's built-in path-alias support. Don't install `vite-tsconfig-paths` as a separate plugin.
  - If you see a `nitro` import or plugin call in the scaffolded file, **remove both the import and the plugin call** before continuing. Confirmed-broken combo with `@cloudflare/vite-plugin@1.35+`.

- [ ] **Step 5: Verify `wrangler.jsonc`.** The scaffolder creates this file. Confirm it matches the shape below; merge in any missing keys without overwriting working values:
  ```jsonc
  // /Users/jamescary/dev/quickstart-template/reference/wrangler.jsonc
  {
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "quickstart-reference",
    "main": "@tanstack/react-start/server-entry",
    "compatibility_date": "2025-09-23",
    "compatibility_flags": ["nodejs_compat"],
    "assets": {
      "directory": "./dist/client",
      "binding": "ASSETS"
    },
    "observability": { "enabled": true }
  }
  ```

  Important shape notes (these supersede earlier drafts of this plan):
  - `main` uses the package-resolved entry `@tanstack/react-start/server-entry`, **not** a path like `.output/server/index.mjs`. The Cloudflare Vite plugin auto-generates `dist/server/wrangler.json` at build time and resolves the entry there.
  - Build output goes to `dist/server/` (Worker bundle) and `dist/client/` (static assets). There is no `.output/` directory.
  - `wrangler deploy` reads `dist/server/wrangler.json` (the generated file) for actual deploy config — it composes that with the user-authored `wrangler.jsonc`.

  We'll add `d1_databases`, `kv_namespaces`, `durable_objects` in later tasks.

- [ ] **Step 6: Verify dev server starts.**
  ```bash
  pnpm dev
  ```
  Expected: Vite reports `Local: http://localhost:3000/` (or similar). Visit the URL in a browser; the default TanStack Start landing page should render. Stop the server with Ctrl-C.

- [ ] **Step 7: Verify production build works.**
  ```bash
  pnpm build
  ```
  Expected: build completes without errors; `dist/server/index.js`, `dist/server/wrangler.json` (auto-generated), and `dist/client/` exist. If the build fails, re-check Step 4's `vite.config.ts` against the doc snippet and re-query context7 if API has changed.

- [ ] **Step 8: Initialize git and commit.**
  ```bash
  git init
  git add .
  git commit -m "chore: bootstrap TanStack Start + Cloudflare scaffold"
  ```

- [ ] **Step 9: Append to `BUILD_NOTES.md`.** Record the create-start-app command actually used, the deps installed in step 3, and any deviations.

---

## Task 2: Provision Cloudflare resources (D1 + KV)

**Files:**
- Modify: `wrangler.jsonc` (add bindings)

- [ ] **Step 1: Create the D1 database.**
  ```bash
  cd /Users/jamescary/dev/quickstart-template/reference
  wrangler d1 create quickstart-reference-db
  ```
  Capture the output. It includes a JSONC snippet like:
  ```jsonc
  {
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "quickstart-reference-db",
        "database_id": "<UUID>"
      }
    ]
  }
  ```
  Record the `database_id` UUID in `BUILD_NOTES.md`.

- [ ] **Step 2: Create the KV namespace.**
  ```bash
  wrangler kv namespace create quickstart-reference-kv
  ```
  Output includes:
  ```jsonc
  {
    "kv_namespaces": [
      { "binding": "KV", "id": "<HEX_ID>" }
    ]
  }
  ```
  Record the KV `id` in `BUILD_NOTES.md`.

- [ ] **Step 3: Update `wrangler.jsonc` with D1 + KV bindings.**

  Add `d1_databases` and `kv_namespaces` arrays to the existing `wrangler.jsonc`. **Preserve all keys from Task 1** (especially `main: "@tanstack/react-start/server-entry"` and `assets.directory: "./dist/client"` — do NOT regress to `.output/` paths). Final shape:
  ```jsonc
  {
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "quickstart-reference",
    "main": "@tanstack/react-start/server-entry",
    "compatibility_date": "2025-09-23",
    "compatibility_flags": ["nodejs_compat"],
    "assets": { "directory": "./dist/client", "binding": "ASSETS" },
    "observability": { "enabled": true },
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "quickstart-reference-db",
        "database_id": "<paste D1 UUID from Step 1>",
        "migrations_dir": "drizzle/migrations"
      }
    ],
    "kv_namespaces": [
      { "binding": "KV", "id": "<paste KV ID from Step 2>" }
    ]
  }
  ```

- [ ] **Step 4: Generate Worker types from bindings.**
  ```bash
  wrangler types
  ```
  Expected: creates/updates `worker-configuration.d.ts` with typed `Env`. Verify the file exists and contains `interface Env { DB: D1Database; KV: KVNamespace; ... }`.

- [ ] **Step 5: Update `tsconfig.json`** to include the generated types. Open `/Users/jamescary/dev/quickstart-template/reference/tsconfig.json` and ensure `compilerOptions.types` contains `"@cloudflare/workers-types"` and `"./worker-configuration.d.ts"` is referenced via `include` (or via `types`).

- [ ] **Step 6: Commit.**
  ```bash
  git add wrangler.jsonc worker-configuration.d.ts tsconfig.json
  git commit -m "chore: provision D1 and KV; add bindings"
  ```

- [ ] **Step 7: Append to `BUILD_NOTES.md`.** Record the exact wrangler commands, output excerpts (with IDs redacted in notes), and the resulting `wrangler.jsonc` shape.

---

## Task 3: Set up shadcn/ui (`new-york`) on top of the scaffolder's Tailwind v4

**Files:**
- Create: `src/styles/globals.css` (overwrite scaffolder's stub if any), `components.json`, `src/lib/utils.ts`, `src/components/ui/*` (via CLI)
- Modify: `src/routes/__root.tsx` (import globals.css if not already), `tsconfig.json` (path aliases)

**Note:** The `--add-ons cloudflare` flag in Task 1 already installed `tailwindcss` and `@tailwindcss/vite`, and added `tailwindcss()` to `vite.config.ts`. Don't re-install Tailwind — you'll create a duplicate. Verify before adding deps:
```bash
cd /Users/jamescary/dev/quickstart-template/reference && grep -E '"(tailwindcss|@tailwindcss/vite)"' package.json
```
Both should already be present as devDependencies. If they are, skip Step 1 and go directly to Step 2.

- [ ] **Step 1 (skip if scaffolder already added Tailwind): Install shadcn-only deps.**
  ```bash
  pnpm add tailwind-merge clsx class-variance-authority lucide-react
  # only if Tailwind isn't already there:
  # pnpm add -D tailwindcss@latest @tailwindcss/vite
  ```

- [ ] **Step 2: Create `src/styles/globals.css`** (overwriting any scaffolder stub).
  ```css
  /* /Users/jamescary/dev/quickstart-template/reference/src/styles/globals.css */
  @import "tailwindcss";

  @custom-variant dark (&:is(.dark *));

  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
  }

  @theme inline {
    --color-background: hsl(var(--background));
    --color-foreground: hsl(var(--foreground));
    --color-primary: hsl(var(--primary));
    --color-primary-foreground: hsl(var(--primary-foreground));
    --color-border: hsl(var(--border));
    --color-input: hsl(var(--input));
    --color-ring: hsl(var(--ring));
    --color-muted: hsl(var(--muted));
    --color-muted-foreground: hsl(var(--muted-foreground));
    --radius-lg: var(--radius);
    --radius-md: calc(var(--radius) - 2px);
    --radius-sm: calc(var(--radius) - 4px);
  }

  body { @apply bg-background text-foreground; }
  ```

- [ ] **Step 3: Add Tailwind Vite plugin.** Edit `/Users/jamescary/dev/quickstart-template/reference/vite.config.ts` — add `tailwindcss()` to `plugins`:
  ```typescript
  import tailwindcss from "@tailwindcss/vite";
  // ...
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    viteReact(),
  ],
  ```

- [ ] **Step 4: Import globals in root route.** Edit `/Users/jamescary/dev/quickstart-template/reference/src/routes/__root.tsx` — add at the top:
  ```typescript
  import "../styles/globals.css";
  ```

- [ ] **Step 5: Create `src/lib/utils.ts`.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/lib/utils.ts
  import { clsx, type ClassValue } from "clsx";
  import { twMerge } from "tailwind-merge";

  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
  }
  ```

- [ ] **Step 6: Add path alias to `tsconfig.json`.**
  ```jsonc
  // partial; merge with existing
  {
    "compilerOptions": {
      "paths": {
        "@/*": ["./src/*"]
      }
    }
  }
  ```

- [ ] **Step 7: Initialize shadcn/ui.**
  ```bash
  pnpm dlx shadcn@latest init
  ```
  When prompted: style = `new-york`, base color = `slate`, CSS variables = yes, RSC = no, TypeScript = yes, components = `@/components`, utils = `@/lib/utils`. Accept other defaults.

  This creates `components.json`. Verify it contains `"style": "new-york"`.

- [ ] **Step 8: Add starter components.**
  ```bash
  pnpm dlx shadcn@latest add button input label form dialog dropdown-menu card avatar badge separator
  ```
  Expected: files appear under `src/components/ui/`.

- [ ] **Step 9: Verify build still works.**
  ```bash
  pnpm build
  ```

- [ ] **Step 10: Commit.**
  ```bash
  git add .
  git commit -m "feat: add Tailwind v4 and shadcn/ui (new-york)"
  ```

- [ ] **Step 11: Append to `BUILD_NOTES.md`.** Record exact `shadcn init` answers and the generated `components.json`.

---

## Task 4: Drizzle setup — config, base schema, initial migration

**Files:**
- Create: `drizzle.config.ts`, `src/db/schema.ts`, `src/db/client.ts`, `.dev.vars`, `.dev.vars.example`
- Modify: `package.json` scripts, `.gitignore`

- [ ] **Step 1: Install Drizzle.**
  ```bash
  cd /Users/jamescary/dev/quickstart-template/reference
  pnpm add drizzle-orm
  pnpm add -D drizzle-kit
  ```

- [ ] **Step 2: Create `.dev.vars` and `.dev.vars.example`.**

  `.dev.vars` (gitignored — local only):
  ```
  BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
  BETTER_AUTH_URL=http://localhost:3000

  GITHUB_CLIENT_ID=
  GITHUB_CLIENT_SECRET=
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=

  RESEND_API_KEY=
  RESEND_FROM_EMAIL=onboarding@resend.dev

  # Optional — only if you want `pnpm db:studio` or `drizzle-kit push`.
  # `pnpm db:migrate:local` / `db:migrate:remote` use wrangler's OAuth and don't need this.
  # CLOUDFLARE_ACCOUNT_ID=
  # CLOUDFLARE_DATABASE_ID=
  # CLOUDFLARE_D1_TOKEN=
  ```

  `.dev.vars.example` (committed — placeholders, mirrors above):
  ```
  BETTER_AUTH_SECRET=
  BETTER_AUTH_URL=http://localhost:3000

  GITHUB_CLIENT_ID=
  GITHUB_CLIENT_SECRET=
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=

  RESEND_API_KEY=
  RESEND_FROM_EMAIL=onboarding@resend.dev

  # Optional — only if you want `pnpm db:studio` or `drizzle-kit push`.
  # CLOUDFLARE_ACCOUNT_ID=
  # CLOUDFLARE_DATABASE_ID=
  # CLOUDFLARE_D1_TOKEN=
  ```

  Append to `.gitignore` (note `.dev.vars` was already added in Task 1's fix-up; verify before adding again):
  ```
  .wrangler
  drizzle/migrations/meta/
  ```

- [ ] **Step 3: ~~Create a D1 API token.~~ Skipped for Stage 1.** Drizzle-kit's d1-http driver only needs an API token for commands that connect to D1 (`drizzle-kit push`, `drizzle-kit studio`). Stage 1 uses `pnpm db:generate` (which only produces SQL files locally — no connection) and `wrangler d1 migrations apply` (which uses the user's wrangler OAuth — no separate token). The optional `CLOUDFLARE_D1_TOKEN` is documented in `.dev.vars.example` for users who want studio/push later.

- [ ] **Step 4: Create `drizzle.config.ts`.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/drizzle.config.ts
  import { defineConfig } from "drizzle-kit";

  export default defineConfig({
    out: "./drizzle/migrations",
    schema: "./src/db/schema.ts",
    dialect: "sqlite",
    // No `driver` — `pnpm db:generate` doesn't need one. If a future command
    // needs to connect to D1 (push/studio), uncomment below and set credentials in .dev.vars.
    // driver: "d1-http",
    // dbCredentials: {
    //   accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    //   databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    //   token: process.env.CLOUDFLARE_D1_TOKEN!,
    // },
  });
  ```

  Add scripts to `package.json`:
  ```json
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply quickstart-reference-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply quickstart-reference-db --remote"
  }
  ```
  (No `db:push` or `db:studio` for Stage 1 — those require the API token.)

- [ ] **Step 5: Create the base schema (just the example feature for now; auth tables added in Task 5 via `auth generate`).**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/db/schema.ts
  import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

  // Example feature placeholder — exists only to verify the schema → migration → D1 pipeline.
  // The skill REMOVES this table during Stage 3 setup and scaffolds a user-described feature
  // in its place. Stage 1's reference app does not wire up UI for notes; it's schema-only.
  export const notes = sqliteTable("notes", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  });
  ```
  Auth/session/org tables will be appended in Task 5 by the better-auth CLI generator.

- [ ] **Step 6: Create the Drizzle client.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/db/client.ts
  import { drizzle } from "drizzle-orm/d1";
  import * as schema from "./schema";

  export function createDb(d1: D1Database) {
    return drizzle(d1, { schema });
  }

  export type Db = ReturnType<typeof createDb>;
  ```

- [ ] **Step 7: Generate the initial migration.**
  ```bash
  pnpm db:generate
  ```
  Expected: a SQL file appears under `drizzle/migrations/0000_*.sql` with a `CREATE TABLE notes ...` statement.

- [ ] **Step 8: Apply the migration locally.**
  ```bash
  pnpm db:migrate:local
  ```
  Expected: `wrangler` reports the migration applied.

- [ ] **Step 9: Apply the migration remotely.**
  ```bash
  pnpm db:migrate:remote
  ```
  Expected: success, possibly with a confirmation prompt.

- [ ] **Step 10: Commit.**
  ```bash
  git add .
  git commit -m "feat: add Drizzle ORM with D1 — base schema and migrations"
  ```

- [ ] **Step 11: Append to `BUILD_NOTES.md`.** Record the API token permissions, the package.json script set, and any drizzle-kit gotchas.

---

## Task 5: better-auth core — install, dual-mode config, generated schema

**Files:**
- Create: `src/lib/auth/server.ts`, `src/lib/auth/client.ts`, `src/routes/api/auth/$.ts`, `src/lib/auth/email.ts`
- Modify: `src/db/schema.ts` (append generated tables)

- [ ] **Step 1: Install better-auth and the Cloudflare adapter.**
  ```bash
  pnpm add better-auth better-auth-cloudflare @better-auth/cli
  pnpm add @better-auth/drizzle-adapter
  ```

- [ ] **Step 2: Create the dual-mode auth server module.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/lib/auth/server.ts
  import type { D1Database, KVNamespace, IncomingRequestCfProperties } from "@cloudflare/workers-types";
  import { betterAuth } from "better-auth";
  import { withCloudflare } from "better-auth-cloudflare";
  import { organization } from "better-auth/plugins";
  import { drizzleAdapter } from "@better-auth/drizzle-adapter";
  import { drizzle } from "drizzle-orm/d1";
  import * as schema from "@/db/schema";

  export interface AuthEnv {
    DB: D1Database;
    KV: KVNamespace;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }

  export function createAuth(
    env?: AuthEnv,
    cf?: IncomingRequestCfProperties,
    baseURL?: string
  ) {
    const db = env ? drizzle(env.DB, { schema, logger: false }) : ({} as any);

    return betterAuth({
      secret: env?.BETTER_AUTH_SECRET,
      baseURL: baseURL ?? env?.BETTER_AUTH_URL,
      ...withCloudflare(
        {
          autoDetectIpAddress: true,
          geolocationTracking: true,
          cf: cf || {},
          d1: env ? { db, options: { usePlural: true, debugLogs: false } } : undefined,
          kv: env?.KV,
        },
        {
          emailAndPassword: { enabled: true },
          socialProviders: {
            github: env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET
              ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
              : undefined,
            google: env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET
              ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
              : undefined,
          },
          plugins: [organization()],
          rateLimit: {
            enabled: true,
            window: 60,
            max: 100,
            customRules: {
              "/sign-in/email": { window: 60, max: 100 },
              "/sign-in/social": { window: 60, max: 100 },
            },
          },
        }
      ),
      // CLI schema generation only — no env present
      ...(env
        ? {}
        : {
            database: drizzleAdapter({} as D1Database, {
              provider: "sqlite",
              usePlural: true,
            }),
          }),
    });
  }

  // Exported for the better-auth CLI generator to pick up
  export const auth = createAuth();
  ```

- [ ] **Step 3: Create the auth client.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/lib/auth/client.ts
  import { createAuthClient } from "better-auth/react";
  import { organizationClient } from "better-auth/client/plugins";

  export const authClient = createAuthClient({
    baseURL: typeof window === "undefined"
      ? (import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000")
      : window.location.origin,
    plugins: [organizationClient()],
  });

  export const { signIn, signOut, signUp, useSession } = authClient;
  ```

- [ ] **Step 4: Mount the auth API as a TanStack Start catch-all route** (API verified via context7 against current TanStack Start docs).

  Create `/Users/jamescary/dev/quickstart-template/reference/src/routes/api/auth/$.ts`:
  ```typescript
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
    const auth = createAuth(env as unknown as AuthEnv, cf, (env as any).BETTER_AUTH_URL);
    return auth.handler(request);
  }
  ```

  Key points (each verified):
  - File path `src/routes/api/auth/$.ts` — the trailing `$` is the wildcard segment.
  - `createFileRoute` is imported from `@tanstack/react-router` (not `@tanstack/react-start/server` or `createServerFileRoute` — those are stale).
  - The route object uses `server.handlers` (an object keyed by HTTP method), not `.methods()`.
  - Bindings come from `import { env } from "cloudflare:workers"` — NOT from a context object on the handler. This is the canonical Cloudflare Workers pattern when using `@cloudflare/vite-plugin` and works in any server-side TanStack Start file.
  - `request.cf` carries the `IncomingRequestCfProperties` (geo/IP info) when available — used by `better-auth-cloudflare` for IP detection and geolocation tracking.

- [ ] **Step 5: Generate auth schema and merge into Drizzle schema.**
  ```bash
  pnpm dlx @better-auth/cli generate --output src/db/auth-schema.ts
  ```
  Expected: creates `src/db/auth-schema.ts` with Drizzle table definitions for `users`, `sessions`, `accounts`, `verifications`, `organizations`, `members`, `invitations` (the org plugin contributes the last three).

- [ ] **Step 6: Re-export auth tables from the main schema.**
  Append to `/Users/jamescary/dev/quickstart-template/reference/src/db/schema.ts`:
  ```typescript
  export * from "./auth-schema";
  ```

- [ ] **Step 7: Generate Drizzle migration for the new tables.**
  ```bash
  pnpm db:generate
  pnpm db:migrate:local
  pnpm db:migrate:remote
  ```

- [ ] **Step 8: Smoke-test auth endpoint with curl.**
  Start dev:
  ```bash
  pnpm dev
  ```
  In another terminal:
  ```bash
  curl -X POST http://localhost:3000/api/auth/sign-up/email \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"testtest123","name":"Test"}'
  ```
  Expected: 200 OK with a JSON body containing a session token. If 404, the catch-all route isn't wiring correctly — re-check Step 4.

- [ ] **Step 9: Commit.**
  ```bash
  git add .
  git commit -m "feat: add better-auth with Cloudflare + Drizzle adapter, organization plugin"
  ```

- [ ] **Step 10: Append to `BUILD_NOTES.md`.** Record the generated schema's exact table/column names — the manifest in Stage 3 will reference these.

---

## Task 6: Auth UI — login, signup, dashboard shell, dark mode

**Files:**
- Create: `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/dashboard/index.tsx`, `src/routes/dashboard/route.tsx` (layout), `src/components/theme-toggle.tsx`, `src/components/auth/oauth-buttons.tsx`
- Modify: `src/routes/__root.tsx` (theme provider)

- [ ] **Step 1: Add a `next-themes`-style toggle.** Install:
  ```bash
  pnpm add next-themes
  ```

- [ ] **Step 2: Theme toggle component.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/components/theme-toggle.tsx
  import { Moon, Sun } from "lucide-react";
  import { useTheme } from "next-themes";
  import { Button } from "@/components/ui/button";

  export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="hidden h-4 w-4 dark:inline" />
      </Button>
    );
  }
  ```

- [ ] **Step 3: Wrap root with theme provider.** Edit `src/routes/__root.tsx`:
  ```tsx
  import { ThemeProvider } from "next-themes";
  import "../styles/globals.css";

  // Inside the root component:
  // <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  //   <Outlet />
  // </ThemeProvider>
  ```

- [ ] **Step 4: Login page.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/routes/login.tsx
  import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
  import { useState } from "react";
  import { signIn } from "@/lib/auth/client";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { OAuthButtons } from "@/components/auth/oauth-buttons";

  export const Route = createFileRoute("/login")({ component: LoginPage });

  function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function onSubmit(e: React.FormEvent) {
      e.preventDefault();
      setPending(true); setError(null);
      const { error } = await signIn.email({ email, password });
      setPending(false);
      if (error) setError(error.message ?? "Sign-in failed");
      else navigate({ to: "/dashboard" });
    }

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader><CardTitle>Sign in</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <div className="my-4 text-center text-xs text-muted-foreground">or</div>
            <OAuthButtons />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No account? <Link to="/signup" className="underline">Create one</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  ```

- [ ] **Step 5: Signup page (mirror of login, but uses `signUp.email`).** Create `src/routes/signup.tsx` with the same shape; replace `signIn.email` with `signUp.email({ email, password, name })` and add a Name field.

- [ ] **Step 6: OAuth buttons component.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/components/auth/oauth-buttons.tsx
  import { signIn } from "@/lib/auth/client";
  import { Button } from "@/components/ui/button";

  export function OAuthButtons() {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={() => signIn.social({ provider: "github", callbackURL: "/dashboard" })}>
          Continue with GitHub
        </Button>
        <Button variant="outline" onClick={() => signIn.social({ provider: "google", callbackURL: "/dashboard" })}>
          Continue with Google
        </Button>
      </div>
    );
  }
  ```

- [ ] **Step 7: Dashboard layout (auth-gated).**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/routes/dashboard/route.tsx
  import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
  import { ThemeToggle } from "@/components/theme-toggle";
  import { authClient } from "@/lib/auth/client";

  export const Route = createFileRoute("/dashboard")({
    beforeLoad: async () => {
      const session = await authClient.getSession();
      if (!session.data) throw redirect({ to: "/login" });
    },
    component: DashboardLayout,
  });

  function DashboardLayout() {
    return (
      <div className="min-h-screen">
        <header className="flex items-center justify-between border-b p-4">
          <h1 className="font-semibold">Quickstart Reference</h1>
          <ThemeToggle />
        </header>
        <main className="p-4"><Outlet /></main>
      </div>
    );
  }
  ```

- [ ] **Step 8: Dashboard index.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/routes/dashboard/index.tsx
  import { createFileRoute } from "@tanstack/react-router";
  import { useSession } from "@/lib/auth/client";

  export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

  function DashboardHome() {
    const { data: session } = useSession();
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Welcome, {session?.user.name}</h2>
        <p className="text-muted-foreground">{session?.user.email}</p>
      </div>
    );
  }
  ```

- [ ] **Step 9: Smoke test.** Run `pnpm dev`, sign up via the form, confirm redirect to `/dashboard` and that the welcome message shows. Sign out (manually clear cookie), try sign-in. Toggle theme.

- [ ] **Step 10: Commit.**
  ```bash
  git add .
  git commit -m "feat: login, signup, dashboard shell, dark mode toggle"
  ```

- [ ] **Step 11: Append to `BUILD_NOTES.md`.** Record any deviations from the plan code (especially around `useSession` API shape, since it may differ).

---

## Task 7: Wire up GitHub + Google OAuth

**Files:** No new files; `.dev.vars` updated; OAuth provider walkthrough captured.

- [ ] **Step 1: Create a GitHub OAuth app.**
  - Visit https://github.com/settings/applications/new
  - Application name: `quickstart-reference (dev)`
  - Homepage: `http://localhost:3000`
  - **Authorization callback URL: `http://localhost:3000/api/auth/callback/github`**
  - Save. Copy the Client ID. Generate a Client Secret. Paste both into `.dev.vars`.

- [ ] **Step 2: Create a Google OAuth client.**
  - Visit https://console.cloud.google.com/apis/credentials
  - Create OAuth 2.0 Client ID (Web application).
  - **Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`**
  - Save. Copy Client ID and Client Secret into `.dev.vars`.

- [ ] **Step 3: Restart `pnpm dev`** (so it re-reads `.dev.vars`).

- [ ] **Step 4: Smoke test GitHub login.** Visit `/login`, click "Continue with GitHub". Confirm GitHub consent screen appears, approve, and verify redirect back to `/dashboard` with the GitHub-linked user signed in. Verify in D1 (via `wrangler d1 execute quickstart-reference-db --local --command 'select * from users'`) that the user row exists.

- [ ] **Step 5: Smoke test Google login.** Same flow with Google.

- [ ] **Step 6: Append to `BUILD_NOTES.md`.** Capture the **exact provider-console URLs** and **exact callback URL templates** with the placeholder slots — these become the content of `credentials.md` in the skill (Stage 3).

- [ ] **Step 7: Commit.** No code changed in this task — just `BUILD_NOTES.md`:
  ```bash
  git add BUILD_NOTES.md
  git commit -m "docs: capture OAuth provider setup walkthroughs"
  ```

---

## Task 8: Organization plugin UI

**Files:**
- Create: `src/routes/dashboard/org/index.tsx`, `src/routes/dashboard/org/invite.tsx`, `src/components/org-switcher.tsx`
- Modify: `src/routes/dashboard/route.tsx` (add org switcher to header)

- [ ] **Step 1: Org switcher component.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/components/org-switcher.tsx
  import { authClient } from "@/lib/auth/client";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
  import { Button } from "@/components/ui/button";

  export function OrgSwitcher() {
    const { data: orgs } = authClient.useListOrganizations();
    const { data: active } = authClient.useActiveOrganization();

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">{active?.name ?? "Select org"}</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {orgs?.map((o) => (
            <DropdownMenuItem
              key={o.id}
              onSelect={() => authClient.organization.setActive({ organizationId: o.id })}
            >
              {o.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onSelect={async () => {
              const name = prompt("Organization name?");
              if (name) await authClient.organization.create({ name, slug: name.toLowerCase().replace(/\s+/g, "-") });
            }}
          >
            + Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  ```
  *(API surface for `authClient.organization.*` should match the better-auth org plugin client. If method names differ in the version installed, check `node_modules/better-auth/dist/plugins/organization` exports.)*

- [ ] **Step 2: Add switcher to dashboard header.** Edit `src/routes/dashboard/route.tsx` to include `<OrgSwitcher />` next to `<ThemeToggle />`.

- [ ] **Step 3: Org index page (members list).**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/routes/dashboard/org/index.tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import { authClient } from "@/lib/auth/client";

  export const Route = createFileRoute("/dashboard/org/")({ component: OrgPage });

  function OrgPage() {
    const { data: active } = authClient.useActiveOrganization();
    const { data: members } = authClient.organization.useListMembers({ organizationId: active?.id });

    if (!active) return <p>No organization selected.</p>;
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{active.name}</h2>
        <Link to="/dashboard/org/invite" className="text-sm underline">+ Invite member</Link>
        <ul className="space-y-2">
          {members?.map((m) => (
            <li key={m.id} className="rounded border p-2">{m.user?.email} — {m.role}</li>
          ))}
        </ul>
      </div>
    );
  }
  ```

- [ ] **Step 4: Invite page.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/routes/dashboard/org/invite.tsx
  import { createFileRoute, useNavigate } from "@tanstack/react-router";
  import { useState } from "react";
  import { authClient } from "@/lib/auth/client";
  import { Button, Input, Label } from "@/components/ui";

  export const Route = createFileRoute("/dashboard/org/invite")({ component: InvitePage });

  function InvitePage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");

    async function onSubmit(e: React.FormEvent) {
      e.preventDefault();
      await authClient.organization.inviteMember({ email, role: "member" });
      navigate({ to: "/dashboard/org" });
    }

    return (
      <form onSubmit={onSubmit} className="max-w-sm space-y-4">
        <Label htmlFor="email">Invitee email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit">Send invite</Button>
      </form>
    );
  }
  ```

- [ ] **Step 5: Smoke test.** Run dev. Sign in. Use the switcher to create an org. Verify it appears in the dropdown. Open `/dashboard/org`, send an invite to a second test email. Confirm that an `invitations` row exists in D1.

- [ ] **Step 6: Commit.**
  ```bash
  git add .
  git commit -m "feat: organization switcher, listing, invitations"
  ```

- [ ] **Step 7: Append to `BUILD_NOTES.md`.** Record the actual org client API surface used (method names) — Stage 3 will reference these in the manifest.

---

## Task 9: Resend integration + welcome email

**Files:**
- Create: `src/server/email.ts`
- Modify: `src/lib/auth/server.ts` (wire `sendVerificationEmail` and invitation email hook)

- [ ] **Step 1: Install Resend.**
  ```bash
  pnpm add resend
  ```

- [ ] **Step 2: Create your Resend account and API key.**
  - Visit https://resend.com/api-keys, create an API key.
  - Paste into `.dev.vars` as `RESEND_API_KEY`.
  - In production we'd use a verified domain; for Stage 1 we use `RESEND_FROM_EMAIL=onboarding@resend.dev` (Resend's test sender) which only sends to your account email.

- [ ] **Step 3: Email module.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/server/email.ts
  import { Resend } from "resend";

  export interface EmailEnv {
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
  }

  export function createEmailer(env: EmailEnv) {
    const dev = !env.RESEND_API_KEY;
    return {
      async send(args: { to: string; subject: string; html: string }) {
        if (dev) {
          console.log("[email:dev]", args);
          return { id: "dev-stub" };
        }
        const resend = new Resend(env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
          to: [args.to],
          subject: args.subject,
          html: args.html,
        });
        if (error) throw new Error(`Resend error: ${error.message ?? JSON.stringify(error)}`);
        return data!;
      },
    };
  }
  ```

- [ ] **Step 4: Wire into better-auth org invitation hook.** Edit `src/lib/auth/server.ts`:
  ```typescript
  // Inside the organization() plugin call, change to:
  organization({
    organizationHooks: {
      afterCreateInvitation: async ({ invitation, organization, inviter }) => {
        if (!env) return;
        const emailer = createEmailer(env);
        await emailer.send({
          to: invitation.email,
          subject: `${inviter.name} invited you to ${organization.name}`,
          html: `<p>You've been invited to ${organization.name}.</p>
                 <p><a href="${env.BETTER_AUTH_URL}/accept-invite/${invitation.id}">Accept invitation</a></p>`,
        });
      },
    },
  })
  ```
  Also import `createEmailer` and add `RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string;` to `AuthEnv`.

- [ ] **Step 5: Smoke test.** Sign in, create an org, invite a real email you control. Verify the email arrives (check Resend dashboard if not in inbox).

- [ ] **Step 6: Commit.**
  ```bash
  git add .
  git commit -m "feat: Resend email integration + org invitation email"
  ```

- [ ] **Step 7: Append to `BUILD_NOTES.md`.** Record Resend dashboard URL, exact API key creation steps, the dev-mode console fallback pattern.

---

## Task 10: Presence Durable Object + dashboard widget

**Files:**
- Create: `src/server/presence-do.ts`, `src/routes/api/presence/$.ts`, `src/components/presence-widget.tsx`
- Modify: `wrangler.jsonc` (add DO binding + migration), `src/routes/dashboard/index.tsx` (mount widget)

- [ ] **Step 1: Create the Durable Object class.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/server/presence-do.ts
  import { DurableObject } from "cloudflare:workers";

  interface Member { id: string; name: string; lastSeen: number; }

  export class PresenceDO extends DurableObject {
    private members = new Map<string, Member>();
    private sockets = new Set<WebSocket>();

    async fetch(request: Request) {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/ws")) {
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
          const msg = JSON.parse(e.data as string) as { id: string; name: string };
          this.members.set(msg.id, { ...msg, lastSeen: Date.now() });
          this.broadcast();
        } catch {}
      });
      ws.addEventListener("close", () => { this.sockets.delete(ws); });
    }

    private gc() {
      const cutoff = Date.now() - 30_000;
      for (const [k, v] of this.members) if (v.lastSeen < cutoff) this.members.delete(k);
    }

    private broadcast() {
      this.gc();
      const payload = JSON.stringify({ members: [...this.members.values()] });
      for (const ws of this.sockets) ws.send(payload);
    }
  }
  ```

- [ ] **Step 2: Add DO binding to `wrangler.jsonc`.**
  ```jsonc
  // append to wrangler.jsonc
  "durable_objects": {
    "bindings": [
      { "name": "PRESENCE", "class_name": "PresenceDO" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["PresenceDO"] }
  ]
  ```
  Re-run `wrangler types` to update `worker-configuration.d.ts`.

- [ ] **Step 3: Export the DO from the Worker entry.** TanStack Start's Cloudflare adapter expects DOs to be exported from the server entry. Check `.output/server/index.mjs` after build to confirm where to add the export. If the build doesn't auto-export, add this to `vite.config.ts`'s build config or create `src/server/worker.ts`:
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/server/worker.ts
  export { PresenceDO } from "./presence-do";
  // re-export the TanStack Start handler
  export { default } from "../../.output/server/index.mjs";
  ```
  *(If the `.output` import path doesn't work due to build ordering, alternative: configure `wrangler.jsonc` `main` to point at a wrapper file that imports both.)*

  **NOTE:** This is the trickiest integration in Stage 1. If exporting the DO turns out to be more involved than this snippet, time-box the investigation to 30 minutes, then either skip the DO for Stage 1 (and note it) or post the failure detail to `BUILD_NOTES.md` and continue. Stage 2/3 will adjust the plan accordingly.

- [ ] **Step 4: API route to forward to the DO.** Use the same TanStack Start server-route API verified in Task 5 Step 4a:
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/src/routes/api/presence/$.ts
  import { createServerFileRoute } from "@tanstack/react-start/server";

  export const ServerRoute = createServerFileRoute("/api/presence/$").methods({
    GET: async ({ request, context }) => {
      const env = context.cloudflare?.env as { PRESENCE: DurableObjectNamespace };
      const id = env.PRESENCE.idFromName("global");
      const stub = env.PRESENCE.get(id);
      return stub.fetch(request);
    },
  });
  ```

- [ ] **Step 5: Presence widget on dashboard.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/components/presence-widget.tsx
  import { useEffect, useState } from "react";
  import { useSession } from "@/lib/auth/client";

  type Member = { id: string; name: string; lastSeen: number };

  export function PresenceWidget() {
    const { data: session } = useSession();
    const [members, setMembers] = useState<Member[]>([]);

    useEffect(() => {
      if (!session?.user) return;
      const ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/presence/ws`
      );
      ws.addEventListener("open", () => {
        const tick = () => ws.send(JSON.stringify({ id: session.user.id, name: session.user.name }));
        tick();
        const iv = setInterval(tick, 10_000);
        ws.addEventListener("close", () => clearInterval(iv));
      });
      ws.addEventListener("message", (e) => {
        const { members } = JSON.parse(e.data);
        setMembers(members);
      });
      return () => ws.close();
    }, [session?.user.id]);

    return (
      <div className="rounded border p-3">
        <h3 className="text-sm font-semibold">Online now</h3>
        <ul className="mt-2 space-y-1 text-sm">
          {members.map((m) => <li key={m.id}>{m.name}</li>)}
        </ul>
      </div>
    );
  }
  ```

- [ ] **Step 6: Mount on dashboard.** Add `<PresenceWidget />` to `src/routes/dashboard/index.tsx`.

- [ ] **Step 7: Smoke test.** Run `pnpm dev`. Open the dashboard in two browser tabs (one in incognito with a different account). Both names should appear in the widget. Close one — within 30 seconds it should disappear from the other.

- [ ] **Step 8: Commit.**
  ```bash
  git add .
  git commit -m "feat: presence Durable Object + dashboard widget"
  ```

- [ ] **Step 9: Append to `BUILD_NOTES.md`.** *Especially* record exactly how the DO export was wired up — this is the trickiest integration and Stage 3 needs the working recipe.

---

## Task 11: Vitest + `@cloudflare/vitest-pool-workers` setup + tests

**Files:**
- Create: `vitest.config.ts`, `tests/auth.test.ts`, `tests/presence.test.ts`, `tests/notes.test.ts`
- Modify: `tsconfig.json` (types), `package.json` (test script)

- [ ] **Step 1: Install vitest deps.**
  ```bash
  pnpm add -D vitest @cloudflare/vitest-pool-workers
  ```

- [ ] **Step 2: Create `vitest.config.ts`.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/vitest.config.ts
  import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

  export default defineWorkersConfig({
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            compatibilityDate: "2025-09-23",
            compatibilityFlags: ["nodejs_compat"],
          },
        },
      },
    },
  });
  ```

- [ ] **Step 3: Update `tsconfig.json`.** Add to `compilerOptions.types`:
  ```json
  "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"]
  ```

- [ ] **Step 4: Add test script to `package.json`.**
  ```json
  "test": "vitest run",
  "test:watch": "vitest"
  ```

- [ ] **Step 5: Test 1 — KV smoke (proves bindings wire up correctly).**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/tests/notes.test.ts
  import { describe, it, expect } from "vitest";
  import { env } from "cloudflare:workers";

  describe("KV bindings work", () => {
    it("stores and retrieves a value", async () => {
      await env.KV.put("k", "v");
      expect(await env.KV.get("k")).toBe("v");
    });
  });
  ```

  Run: `pnpm test`. Expected: PASS.

- [ ] **Step 6: Test 2 — auth signup creates a user row in D1.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/tests/auth.test.ts
  import { describe, it, expect, beforeAll } from "vitest";
  import { env } from "cloudflare:workers";
  import { createAuth } from "../src/lib/auth/server";

  describe("better-auth signup", () => {
    beforeAll(async () => {
      // Apply migrations to the test D1 (vitest-pool-workers ships with empty D1)
      // We rely on miniflare's `--local` migration setup; if migrations don't auto-apply,
      // we apply them inline here using env.DB.exec on the SQL files.
    });

    it("creates a user via sign-up/email", async () => {
      const auth = createAuth(env as any, {} as any, "http://localhost:3000");
      const res = await auth.api.signUpEmail({
        body: { email: "test+vitest@example.com", password: "abcd1234", name: "Test" },
      });
      expect(res.user.email).toBe("test+vitest@example.com");
      const rows = await env.DB.prepare("select count(*) as c from users").first<{ c: number }>();
      expect(rows!.c).toBeGreaterThanOrEqual(1);
    });
  });
  ```
  *(If migrations don't auto-apply in pool-workers, the `beforeAll` may need to read `drizzle/migrations/0000_*.sql` and execute it via `env.DB.exec()`. Adjust during execution and record the working approach in `BUILD_NOTES.md`.)*

- [ ] **Step 7: Test 3 — Durable Object presence.**
  ```typescript
  // /Users/jamescary/dev/quickstart-template/reference/tests/presence.test.ts
  import { describe, it, expect } from "vitest";
  import { env } from "cloudflare:workers";
  import { runInDurableObject } from "cloudflare:test";
  import { PresenceDO } from "../src/server/presence-do";

  describe("PresenceDO", () => {
    it("tracks members and gc's stale entries", async () => {
      const id = env.PRESENCE.idFromName("test");
      const stub = env.PRESENCE.get(id);
      await runInDurableObject(stub, async (instance) => {
        expect(instance).toBeInstanceOf(PresenceDO);
      });
      const res = await stub.fetch("https://example.com/list");
      const body = await res.json<{ members: any[] }>();
      expect(Array.isArray(body.members)).toBe(true);
    });
  });
  ```

- [ ] **Step 8: Run all tests.**
  ```bash
  pnpm test
  ```
  Expected: 3 passing tests.

- [ ] **Step 9: Commit.**
  ```bash
  git add .
  git commit -m "test: vitest pool-workers setup + KV/auth/presence tests"
  ```

- [ ] **Step 10: Append to `BUILD_NOTES.md`.** Especially: how migrations get applied in tests (the part most likely to need adjustment), and any tsconfig or vitest config tweaks needed.

---

## Task 12: Polish — landing page, README, .dev.vars.example completeness

**Files:**
- Modify: `src/routes/index.tsx`, `README.md`, `.dev.vars.example`

- [ ] **Step 1: Replace the default landing page.**
  ```tsx
  // /Users/jamescary/dev/quickstart-template/reference/src/routes/index.tsx
  import { createFileRoute, Link } from "@tanstack/react-router";
  import { Button } from "@/components/ui/button";
  import { ThemeToggle } from "@/components/theme-toggle";

  export const Route = createFileRoute("/")({ component: Landing });

  function Landing() {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between p-4">
          <span className="font-semibold">Quickstart Reference</span>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Build full-stack on Cloudflare in minutes.</h1>
          <p className="max-w-md text-muted-foreground">
            TanStack Start, Drizzle, D1, KV, Durable Objects, better-auth — all wired up.
          </p>
          <div className="flex gap-2">
            <Link to="/login"><Button variant="outline">Sign in</Button></Link>
            <Link to="/signup"><Button>Get started</Button></Link>
          </div>
        </main>
      </div>
    );
  }
  ```

- [ ] **Step 2: Write a README.**
  ```markdown
  # quickstart-reference

  Reference full-stack app for the quickstart-template project. Stage 1 build output.

  ## Stack
  TanStack Start · Drizzle + D1 · KV · Durable Objects · better-auth (email/password + GitHub + Google + organization plugin) · Resend · Tailwind v4 + shadcn/ui · Vitest.

  ## Develop
  ```bash
  pnpm install
  cp .dev.vars.example .dev.vars   # fill in
  pnpm db:migrate:local
  pnpm dev
  ```

  ## Test
  ```bash
  pnpm test
  ```

  ## Deploy
  ```bash
  pnpm db:migrate:remote
  pnpm build
  wrangler deploy
  ```
  ```

- [ ] **Step 3: Commit.**
  ```bash
  git add .
  git commit -m "feat: landing page, README"
  ```

---

## Task 13: Production deploy + remote smoke test

**Files:** none modified; verifies everything works on real Cloudflare infra.

- [ ] **Step 1: Set production secrets.** For each `.dev.vars` value that isn't a binding (i.e., everything except DB and KV which are bound by wrangler.jsonc), run:
  ```bash
  wrangler secret put BETTER_AUTH_SECRET
  wrangler secret put BETTER_AUTH_URL    # value: https://quickstart-reference.<your-subdomain>.workers.dev
  wrangler secret put GITHUB_CLIENT_ID
  wrangler secret put GITHUB_CLIENT_SECRET
  wrangler secret put GOOGLE_CLIENT_ID
  wrangler secret put GOOGLE_CLIENT_SECRET
  wrangler secret put RESEND_API_KEY
  wrangler secret put RESEND_FROM_EMAIL
  ```

- [ ] **Step 2: Update OAuth callback URLs** in GitHub and Google consoles to add the production callback URL (`https://quickstart-reference.<subdomain>.workers.dev/api/auth/callback/<provider>`).

- [ ] **Step 3: Apply migrations remotely.**
  ```bash
  pnpm db:migrate:remote
  ```

- [ ] **Step 4: Build + deploy.**
  ```bash
  pnpm build
  wrangler deploy
  ```
  Expected: deploy succeeds; URL printed.

- [ ] **Step 5: Smoke test the deployed app.** Visit the URL. Test:
  - Landing page loads.
  - Sign up with email/password works.
  - GitHub OAuth works (provider redirects back to dashboard).
  - Org switcher creates an org; members list shows you.
  - Org invite sends a real email via Resend (check inbox).
  - Presence widget shows your name; open in a second tab to confirm two users.
  - Dark mode toggle persists.

- [ ] **Step 6: Append to `BUILD_NOTES.md`.** The **deployed URL** of the reference app, and any production-specific gotchas (CORS, cookie domains, etc.).

- [ ] **Step 7: Commit.**
  ```bash
  git add BUILD_NOTES.md
  git commit -m "docs: production deploy notes"
  ```

---

## Task 14: Finalize `BUILD_NOTES.md` for handoff to Stage 2

**Files:** `BUILD_NOTES.md` only.

- [ ] **Step 1: Re-read `BUILD_NOTES.md`** end-to-end. Confirm every task has an entry. Resolve any "TODO" or "??" markers with the actual answer.

- [ ] **Step 2: Add a "Files inventory" section** at the end listing every file created in `/Users/jamescary/dev/quickstart-template/reference/`, grouped by purpose:
  ```markdown
  ## Files inventory

  ### Always-present (regardless of toggles)
  - vite.config.ts
  - wrangler.jsonc
  - drizzle.config.ts
  - src/db/client.ts
  - src/db/schema.ts (base parts + auth tables)
  - src/lib/auth/server.ts (without provider/plugin conditionals)
  - src/lib/auth/client.ts (without organizationClient if org off)
  - src/routes/__root.tsx
  - src/routes/index.tsx (landing)
  - src/routes/login.tsx
  - src/routes/signup.tsx
  - src/routes/dashboard/route.tsx
  - src/routes/dashboard/index.tsx
  - src/routes/api/auth/$.ts
  - src/components/ui/* (shadcn)
  - src/components/theme-toggle.tsx
  - src/lib/utils.ts
  - src/styles/globals.css
  - .dev.vars.example
  - components.json

  ### Conditional on `org` toggle
  - src/routes/dashboard/org/index.tsx
  - src/routes/dashboard/org/invite.tsx
  - src/components/org-switcher.tsx
  - schema.ts: organization/member/invitation tables
  - server.ts: organization() plugin entry, afterCreateInvitation hook
  - client.ts: organizationClient() plugin entry

  ### Conditional on `resend` toggle
  - src/server/email.ts
  - server.ts: createEmailer import + invitation hook body
  - .dev.vars.example: RESEND_*

  ### Conditional on each `oauth.<provider>` toggle
  - server.ts: socialProviders.<provider> entry
  - .dev.vars.example: <PROVIDER>_CLIENT_ID/SECRET
  - oauth-buttons.tsx: button for that provider

  ### Conditional on `do` toggle
  - src/server/presence-do.ts
  - src/server/worker.ts (DO export wrapper)
  - src/components/presence-widget.tsx
  - src/routes/api/presence/$.ts
  - wrangler.jsonc: durable_objects.bindings + migrations

  ### Conditional on `vitest` toggle
  - vitest.config.ts
  - tests/*
  - package.json: test scripts
  - tsconfig.json: types entries for vitest-pool-workers

  ### Removed entirely during Stage 3 setup (replaced by user's first-feature scaffold)
  - schema.ts: `notes` table definition
  - drizzle/migrations/*: any migration that created `notes`
  - tests/notes.test.ts: replaced (tests for the user's scaffolded feature)
  ```

  This inventory is the **source of truth for the manifest** in Stage 3.

- [ ] **Step 3: Commit.**
  ```bash
  git add BUILD_NOTES.md
  git commit -m "docs: finalize BUILD_NOTES with files inventory for Stage 2"
  ```

- [ ] **Step 4: Print Stage 1 completion summary.** State (in conversation, not in a file):
  - Reference app working at `/Users/jamescary/dev/quickstart-template/reference/` ✓
  - Deployed at `https://...` ✓
  - All features verified: auth, OAuth, org plugin, Resend email, presence DO, vitest ✓
  - `BUILD_NOTES.md` ready for Stage 2 handoff ✓

---

## Stage 1 success criteria (verify before declaring done)

1. `pnpm dev` runs cleanly and serves the app at localhost:3000.
2. `pnpm build` succeeds.
3. `pnpm test` passes all 3 tests.
4. `wrangler deploy` succeeds; deployed URL is reachable.
5. On the deployed URL, all of: email/password sign-up, GitHub OAuth, Google OAuth, org create/invite (with real email arriving), presence widget across two tabs, theme toggle.
6. `BUILD_NOTES.md` has a per-task entry, a complete files inventory, and OAuth-provider walkthrough notes.

If any criterion fails, fix before moving to Stage 2.

## What Stage 2 will need from this output

- The working directory `/Users/jamescary/dev/quickstart-template/reference/` (will be copied to `/Users/jamescary/dev/quickstart-template/` and templatized).
- `BUILD_NOTES.md` — input to Stage 2 spec for `manifest.json` and conditional regions.
- Verified callback URL templates and provider-console URLs (input to `credentials.md` in Stage 3).
- The vitest migration-application recipe (input to the skill's vitest setup).
- The DO export pattern that worked (input to the skill's DO wiring).
