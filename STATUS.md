# quickstart-template — project status

**Last updated:** 2026-05-01

This is the working directory for the **quickstart-template** project: a Cloudflare-native full-stack starter (TanStack Start · Drizzle · D1 · KV · Durable Objects · better-auth · Resend) plus an agent-driven setup skill that interviews users and customizes new projects from the template. See `docs/superpowers/specs/2026-04-30-quickstart-template-design.md` for the full design.

## Stage progress

| Stage | Status | Output |
|---|---|---|
| **Brainstorm + spec** | ✅ Done | `docs/superpowers/specs/2026-04-30-quickstart-template-design.md` |
| **Stage 1 — reference app build** | ✅ Done (2026-05-01) | `reference/` (44 commits) deployed at `https://quickstart-reference.eliteeggnog.workers.dev`. Per-task log + Files Inventory at `reference/BUILD_NOTES.md`. Plan: `docs/superpowers/plans/2026-04-30-stage1-reference-app.md`. |
| **Stage 2 — templatize** | ⏳ Pending | Will copy `reference/` → repo root, wrap conditional regions with `// #region quickstart:if=X` markers per the BUILD_NOTES Files Inventory, replace literals with `__PROJECT_NAME__` sentinels, manually validate subtraction. Plan to be written. |
| **Stage 3 — build setup skill** | ⏳ Pending | `.claude/skills/quickstart-setup/` with manifest, interview, cloudflare, credentials sub-files. Plan to be written. |

## Where things live

```
/Users/jamescary/dev/quickstart-template/
├── STATUS.md                                    # this file
├── .gitignore                                   # gitignores reference/ (it's a self-contained nested repo)
├── docs/superpowers/
│   ├── specs/2026-04-30-quickstart-template-design.md
│   └── plans/2026-04-30-stage1-reference-app.md  # Stage 1 plan, marked complete
└── reference/                                   # Stage 1 output (NESTED git repo, gitignored from outer)
    ├── BUILD_NOTES.md                           # 1145 lines: per-task log + Files Inventory
    ├── src/, package.json, wrangler.jsonc, ...  # full working app
    └── .git/                                    # 44 commits
```

## To pick up where we left off

A fresh session resuming this project should:

1. Read this `STATUS.md`.
2. Skim `docs/superpowers/specs/2026-04-30-quickstart-template-design.md` (the design — read at minimum the Architecture, Subtractive Transformation, and Development Plan sections).
3. Read `reference/BUILD_NOTES.md`'s Files Inventory section near the end (the Stage 2 input).
4. Decide what to do next — most likely **write the Stage 2 plan** using the `superpowers:writing-plans` skill, with `BUILD_NOTES.md`'s Files Inventory as the primary input. Save the resulting plan to `docs/superpowers/plans/YYYY-MM-DD-stage2-templatize.md`.

## Stage 1 known limitations (worth knowing for Stage 2/3)

- **Browser-driven Google OAuth login from the deployed worker fails** at Google's redirect-URI-mismatch check. Cause: Stage 1 borrowed Google OAuth credentials from another project whose authorized redirect URIs don't include this worker's URL. Curl-level wiring was verified. To fully work in production, the Google OAuth client needs `https://quickstart-reference.eliteeggnog.workers.dev/api/auth/callback/google` added to its authorized redirect URIs in Google Cloud Console.
- **GitHub OAuth was never wired in Stage 1** (skipped to keep the interactive checkpoints small). Walkthrough captured in BUILD_NOTES Task 7 for Stage 3 to scaffold from.
- **`/accept-invitation/$id` route is unbuilt.** The org-plugin invitation email's CTA links to a 404. Stage 3 should scaffold the route. See BUILD_NOTES Task 9.
- **`sendVerificationEmail` hook not wired.** Conditional on `requireEmailVerification: true` which we didn't enable. Stage 3 should add when the user enables verification. See BUILD_NOTES Task 9.
- **Reference uses borrowed Google creds + Resend creds in production.** The user (videojames@icloud.com) authorized this. Worth noting for hygiene if the project is ever published or shared.

## Stage 1 patterns that Stage 3 should preserve verbatim

These are the non-obvious ones, all documented in BUILD_NOTES with reasoning:

1. **Cloudflare Vite plugin output is `dist/`, not `.output/`.** `wrangler.jsonc` `main` is the package-resolved `@tanstack/react-start/server-entry` for plain apps; switch to `src/server.ts` only when adding Durable Objects.
2. **TanStack Start server routes** use `createFileRoute` with `server.handlers`, not `createServerFileRoute`.
3. **Cloudflare bindings access** is `import { env } from "cloudflare:workers"` everywhere server-side.
4. **better-auth dual-mode `createAuth(env?, cf?, baseURL?)`** — same factory works for CLI schema generation (no env) and runtime (with env). Called per-request because `env` is request-scoped on Workers.
5. **SSR session checks use `auth.api.getSession({ headers: request.headers })`** with the server-side `createAuth` instance — not `authClient.getSession()` (which would HTTP-round-trip and fail when `VITE_BETTER_AUTH_URL` is baked at build time).
6. **DurableObject export pattern**: create `src/server.ts` with `createServerEntry`, re-export DO classes alongside the default fetch handler, change `wrangler.jsonc` `main` to `src/server.ts`.
7. **vitest-pool-workers v4** uses `cloudflareTest()` plugin + plain `defineConfig` (NOT `defineWorkersConfig`).
8. **Tests can't import `createAuth`** because the `resend → svix@1.90` chain is CJS-only and Workers reject it; tests use a separate `tests/worker-entry.ts` that exports only the DO class.
9. **Drizzle migrations applied in tests via `applyD1Migrations` from `cloudflare:test`** at module-level setup, with migrations bundled by the `cloudflareTest` plugin's `readD1Migrations`.

## Live reference URL

`https://quickstart-reference.eliteeggnog.workers.dev`

(Cloudflare account: `0f997a2a37f2fa76b043482c585a5435` / eliteeggnog@gmail.com)
