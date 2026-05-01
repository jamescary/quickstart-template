# quickstart-template — project status

**Last updated:** 2026-05-01 (Stage 3 complete)

This is the working directory for the **quickstart-template** project: a Cloudflare-native full-stack starter (TanStack Start · Drizzle · D1 · KV · Durable Objects · better-auth · Resend) plus an agent-driven setup skill that interviews users and customizes new projects from the template. See `docs/superpowers/specs/2026-04-30-quickstart-template-design.md` for the full design.

## Stage progress

| Stage | Status | Output |
|---|---|---|
| **Brainstorm + spec** | ✅ Done | `docs/superpowers/specs/2026-04-30-quickstart-template-design.md` |
| **Stage 1 — reference app build** | ✅ Done (2026-05-01) | `reference/` (44 commits) deployed at `https://quickstart-reference.eliteeggnog.workers.dev`. Per-task log + Files Inventory at `reference/BUILD_NOTES.md`. Plan: `docs/superpowers/plans/2026-04-30-stage1-reference-app.md`. |
| **Stage 2 — templatize** | ✅ Done (2026-05-01) | Reference copied to repo root with region markers + sentinels. Subtraction validated by hand for all 5 toggles. Subtraction recipes captured at `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`. Plan: `docs/superpowers/plans/2026-05-01-stage2-templatize.md`. Bootstrap files (`install.sh`, `install.md`, `.quickstart-template`, user-facing `README.md`) added. Template at-rest typechecks; does not build or run until Stage 3 substitutes sentinels and provisions IDs. |
| **Stage 3 — build setup skill** | ✅ Done (2026-05-01) | `.claude/skills/quickstart-setup/` — `SKILL.md`, `manifest.json`, `interview.md`, `cloudflare.md`, `credentials.md`, `scaffold-feature.md`, `TEMPLATE_URL`. Plan: `docs/superpowers/plans/2026-05-01-stage3-build-skill.md`. E2E tests (Tasks 13–15) require interactive Claude Code sessions in scratch dirs; instructions captured in `STAGE3_NOTES.md` for the user to run, then folded back here. `__GH_USER__` substituted to `jamescry`. Template ready to publish. |

## Where things live

```
/Users/jamescary/dev/quickstart-template/
├── STATUS.md                                    # this file
├── README.md                                    # user-facing template README (sentinelized)
├── install.sh                                   # curl-pipeable bootstrapper
├── install.md                                   # agent-readable bootstrap
├── .quickstart-template                         # marker for skill entry detection
├── package.json, wrangler.jsonc, tsconfig.json, ...  # full template (sentinelized)
├── src/, tests/, drizzle/                       # template source (region-marked)
├── .claude/skills/quickstart-setup/             # Stage 3 output: the setup skill (auto-loaded)
│   ├── SKILL.md                                 # frontmatter + lifecycle + Apply Steps 1–11
│   ├── manifest.json                            # declarative subtraction spec (6 toggles + combinatorial)
│   ├── interview.md                             # Phase 1/2/3/6 question scripts
│   ├── cloudflare.md                            # Phase 4 wrangler provisioning
│   ├── credentials.md                           # Phase 5 OAuth/Resend walkthroughs + deploy-secrets.sh template
│   ├── scaffold-feature.md                      # Apply Step 6 (only generative phase)
│   └── TEMPLATE_URL                             # plain-text template URL (used by global-install mode)
├── docs/superpowers/
│   ├── specs/2026-04-30-quickstart-template-design.md
│   ├── specs/2026-05-01-stage2-subtraction-recipes.md   # Stage 2 output: per-toggle subtraction recipes (Stage 3 input)
│   ├── plans/2026-04-30-stage1-reference-app.md   # Stage 1 plan, complete
│   ├── plans/2026-05-01-stage2-templatize.md      # Stage 2 plan, complete
│   └── plans/2026-05-01-stage3-build-skill.md     # Stage 3 plan, complete
└── reference/                                   # Stage 1 output (NESTED git repo, gitignored)
    ├── BUILD_NOTES.md                           # 1145 lines: per-task log + Files Inventory
    └── ... (full working app)
```

## To pick up where we left off

Stages 1, 2, and 3 are complete. The template is **ready to publish**: push this repo to `https://github.com/jamescry/quickstart-template` and `install.sh` / `TEMPLATE_URL` will resolve. Pending validation: the three E2E test combinations described in `STAGE3_NOTES.md` need to be run by the user in fresh Claude Code sessions; results fold back into this file.

Optional next steps:
- Run E2E tests per `STAGE3_NOTES.md` (3 fresh sessions; ~10–30 minutes each).
- Tag a release: `git tag -a v0.1.0 -m "First publishable release of quickstart-template"`.
- Push to GitHub and verify `install.sh` works against the public repo.

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

## Stage 2 known limitations / things deferred to Stage 3

- **Sentinelized template doesn't build or run as-is.** `__PROJECT_SLUG__` is rejected by `@cloudflare/vite-plugin`'s wrangler validation (`name` must match `[a-z0-9-]+`), so `pnpm build` fails post-Task-12; `pnpm test` also depends on a valid wrangler config. **Verification floor at Stage 2-rest is `pnpm typecheck` only.** Stage 3's skill must substitute sentinels and provision real IDs *before* `pnpm build` / `pnpm dev` / `pnpm test` work for the user.
- **Schema regen is Stage 3's job.** Stage 2 leaves `src/db/auth-schema.ts` with all tables (incl. org tables) regardless of toggles. Stage 3 runs `pnpm exec @better-auth/cli generate` to regenerate the file with only the chosen plugins' tables.
- **`worker-configuration.d.ts` is stale-by-design.** Stage 3 must run `pnpm exec wrangler types` after stripping `wrangler.jsonc` regions and writing real IDs.
- **Both-OAuth-providers-off cleanup is combinatorial, not in regions.** When neither GitHub nor Google is selected, the `OAuthButtons` component renders an empty div. Stage 3's skill must detect the both-off case and additionally delete `oauth-buttons.tsx` + strip imports/JSX from `login.tsx` and `signup.tsx`.
- **`scripts/deploy-secrets.sh` is not in the template.** Stage 3 generates it during the Apply phase from the user's chosen `.dev.vars` keys.
- **`__GH_USER__` placeholder in `install.sh` and `install.md`.** Stage 3 (or template publishing step) must replace this with the actual GitHub user/org hosting the template repo.
- **`tsconfig.json` excludes `reference/` and `vitest.config.ts` `test.include` is scoped to `tests/`.** Both adjustments were necessary because `reference/` (Stage 1's git-ignored archive) sits at the repo root; without them, tooling spans the reference's own deps and tests. These exclusions are part of the template's permanent shape.

## Stage 3 known limitations / things deferred

- **Workers Git Integration's last step is manual.** No fully-automated API as of 2026-05-01 — after `gh repo create`, the user must connect the repo via the Cloudflare dashboard. The skill's Apply Step 9 prints the dashboard URL and walks through the click-path.
- **Programmatic superpowers install may not work in all Claude Code versions.** Apply Step 10 writes `enabledPlugins: ["superpowers"]` into `.claude/settings.json` and falls back to printing `/plugin install superpowers` if the write fails. Treat this as best-effort; the print fallback is the never-silently-broken path.
- **`gh` CLI is required for the Workers Git Integration auto-path.** If the user answers `y` to Q10 but `gh` is absent or unauthenticated, Apply Step 9 prints manual setup steps instead of failing.
- **First-feature scaffold is intentionally minimal** — list + inline create form only. Edit, delete, optimistic updates, pagination, sharing UI, and tests for the new feature are deferred to the user.
- **E2E tests not yet run by the agent.** The skill is interactive (interview-driven), and the plan's Tasks 13–15 require fresh Claude Code sessions in scratch dirs. Instructions are captured in `STAGE3_NOTES.md` for the user to run; results should be folded back into this file under a "Stage 3 E2E findings" section once available.

## Stage 2 patterns Stage 3 should preserve verbatim

1. **Region marker syntax** has 4 variants by file type — see `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md` "Marker convention" section.
2. **Stripping a region removes the marker lines themselves** along with the body. Plain non-`#region` comments are unaffected.
3. **Nested regions encode AND logic** — outer-first stripping. The `createEmailer` import in `src/lib/auth/server.ts` uses `org` outer + `resend` inner; either toggle off strips it. Stage 3's strip implementation must support nesting.
4. **Sentinels:** exactly `__PROJECT_NAME__`, `__PROJECT_SLUG__`, `__PROJECT_DESCRIPTION__`, `__BRAND_COLOR__`. No others. Don't invent new ones in Stage 3 — extend this list explicitly if needed.
5. **D1/KV IDs use all-zeros placeholders, not sentinels.** The skill overwrites by binding name (`DB`, `KV`), not by detecting placeholder text.
6. **`tests/` is whole-file deletion when `vitest` off; `tests/worker-entry.ts` is a `replace` op when `do` off.** See recipe doc Task 10.

## Live reference URL

`https://quickstart-reference.eliteeggnog.workers.dev`

(Cloudflare account: `0f997a2a37f2fa76b043482c585a5435` / eliteeggnog@gmail.com)
