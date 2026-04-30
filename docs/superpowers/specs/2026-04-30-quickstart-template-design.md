# Quickstart Template — Design

**Date:** 2026-04-30
**Status:** Draft for user review
**Owner:** James Cary

## Summary

A Cloudflare-native full-stack project template plus an agent-driven setup skill. The template ships as a working TanStack Start app with every supported feature wired up; the skill interviews the user, provisions Cloudflare resources autonomously, subtracts opted-out features, scaffolds one user-described starter feature, and self-removes. After setup, the user has a clean, deployable project with the superpowers skill collection installed.

**Stack:** TanStack Start (frontend + server functions) · Drizzle ORM · Cloudflare D1 · Cloudflare KV · Cloudflare Durable Objects · better-auth (email/password + OAuth + optional organization plugin) · Resend (optional) · Tailwind v4 + shadcn/ui (`new-york`) · vitest + `@cloudflare/vitest-pool-workers` (optional) · pnpm.

**Cloudflare config format:** `wrangler.jsonc` (not `wrangler.toml`). The skill mutates this file using a JSONC-aware editor when adding D1/KV IDs and DO bindings — never naive string replacement.

**Inspiration:** [backpine/saas-kit](https://github.com/backpine/saas-kit). This template diverges by dropping billing, staying in a single package (no monorepo), and being agent-driven on first run.

## Goals

1. A user with a Cloudflare Workers Paid account can go from "I want to build something" to a deployed full-stack app in under 15 minutes, with no manual config-file editing.
2. The template itself is a real, runnable, testable app at all times — not a snippet collection.
3. The setup skill is mechanical transformation logic. The only generative phase is the first-feature scaffold; everything else is delete/rename/wire-up.
4. After setup, no setup-specific code remains in the user's project. The skill self-removes; superpowers stays installed.

## Non-Goals

- Billing (Stripe / Polar / Paddle).
- Native mobile.
- Monorepo or multi-worker projects.
- Automated DNS / custom-domain setup. Skill prints manual instructions only.
- Multiple OAuth apps of the same provider.
- "Add feature X to existing project" — skill is one-shot setup; later changes are user-directed Claude work.
- Migration from an existing project. Greenfield only.

## Architecture

Two artifacts live in one repo:

1. **The template** — a fully working TanStack Start app with *every* opt-in feature on. `git clone && pnpm install && pnpm dev` works end-to-end before any skill runs. Every feature is exercised by the existing pages so regressions are caught at the source, not at output time.
2. **The setup skill** at `.claude/skills/quickstart-setup/` — a single skill embedded in the template. It interviews the user, provisions Cloudflare resources, subtracts opted-out features, renames placeholders, scaffolds one starter feature, installs the superpowers plugin, and deletes itself.

### Entry points

In priority order (most prominent in README first):

1. **Curl one-liner.** `curl -fsSL https://raw.githubusercontent.com/<user>/<template>/main/install.sh | bash -s -- my-app` — clones the template into `my-app/`, runs `pnpm install`, removes inherited `.git/`, initializes a fresh repo, then prints: *"Open this directory in Claude Code, Codex, or Cursor and say 'run quickstart-setup'."*
2. **Agent prompt with install.md.** For users already in their agent: paste *"Read `https://.../install.md` and follow it"*. The install.md mirrors install.sh in natural-language form an agent can execute step by step.
3. **Claude Code native.** `/quickstart my-app` — assumes the skill is globally installed. Global publishing (plugin marketplace) is **deferred** in the initial build; until then, users on this path manually copy the skill directory into `~/.claude/skills/` from the template repo.
4. **Manual.** `npx degit <repo> my-app && cd my-app && claude`.

All four converge at "agent runs the `quickstart-setup` skill in the cloned directory." The shell handles deterministic plumbing (clone, install); the agent handles the interactive interview.

### Template structure

```
quickstart-template/
├── README.md                     # entry-point overview, points users at install.sh
├── install.sh                    # curl-pipeable bootstrapper
├── install.md                    # agent-readable equivalent of install.sh
├── .quickstart-template          # marker file — skill deletes this on completion
├── .claude/
│   └── skills/
│       └── quickstart-setup/     # the setup skill (self-removes after run)
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc
├── drizzle.config.ts
├── src/
│   ├── routes/                   # TanStack file-based routes
│   │   ├── __root.tsx
│   │   ├── index.tsx             # landing
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── dashboard/            # post-auth shell, presence widget (DO), settings
│   ├── server/
│   │   ├── auth.ts               # better-auth config (email/pw, OAuth, org plugin)
│   │   ├── db/
│   │   │   ├── schema.ts         # users, sessions, orgs, example feature table
│   │   │   └── client.ts         # D1 → Drizzle binding
│   │   ├── email.ts              # Resend client + dev-mode console fallback
│   │   ├── kv.ts                 # KV helper
│   │   └── durable-objects/      # one example DO (presence)
│   ├── components/ui/            # shadcn components
│   ├── components/               # app-level components
│   └── lib/
├── drizzle/                      # generated migrations
├── tests/                        # vitest examples (server fn, auth, DO)
├── vitest.config.ts
└── .dev.vars.example             # env keys for OAuth + Resend (placeholders)
```

### Subtractive transformation

The skill removes opted-out features using two complementary mechanisms.

**Whole-file deletion via `manifest.json`** — primary tool. Each toggle maps to a list of paths and config keys to remove:

| Toggle off | Removed |
|---|---|
| `resend` | `src/server/email.ts`, Resend dep, `RESEND_*` env keys, dev-mode logger restored |
| `org` | Drizzle org tables, `src/routes/dashboard/org/`, `components/org-switcher.tsx`, org plugin entry in `auth.ts` |
| `oauth.<provider>` | provider config in `auth.ts`, env keys, login-page button |
| `do` | `src/server/durable-objects/`, `wrangler.jsonc` `durable_objects.bindings` entries, presence widget on dashboard |
| `vitest` | `tests/`, `vitest.config.ts`, vitest deps |

**In-file region markers** — for the small number of files that mix mandatory and optional content (`auth.ts`, `schema.ts`, dashboard page, login page). Syntax:

```ts
// #region quickstart:if=resend
import { sendEmail } from "./email";
// #endregion
```

The skill strips a region if its tag evaluates to false. Each tag corresponds 1:1 with an interview toggle.

**Verification.** After all subtraction, the skill runs `pnpm typecheck` and `pnpm build`. Failure aborts with a diagnostic identifying the likely missed reference — the skill never leaves the project in a half-broken state.

**Renaming.** A second pass replaces sentinel placeholders globally:

- `__PROJECT_NAME__` → user-facing display name
- `__PROJECT_SLUG__` → kebab-case name (used in `package.json`, `wrangler.jsonc`, deployment URL)
- `__PROJECT_DESCRIPTION__` → one-sentence description
- `__BRAND_COLOR__` → hex color, applied to shadcn config

Sentinels are unambiguous and never collide with the literal word `quickstart`.

**First-feature scaffolding** — a separate, generative phase. The skill takes the user's 1–2 sentence feature description, plans a minimal scaffold (one Drizzle table + one server-function module + one route + one component), shows the plan for confirmation, then writes the files. This is the *only* phase where the LLM generates non-recipe content; everything else is mechanical transformation.

### Skill structure & lifecycle

```
.claude/skills/quickstart-setup/
├── SKILL.md                 # frontmatter + orchestration; only file auto-loaded
├── interview.md             # question scripts for each phase
├── manifest.json            # toggle → files-to-delete + region-tags-to-strip
├── cloudflare.md            # wrangler command sequences and output parsers
├── credentials.md           # per-OAuth-provider walkthroughs (links, callback URLs, env keys)
├── scaffold-feature.md      # rules for planning + writing the first feature
└── TEMPLATE_URL             # plain text file: template repo URL (used by global mode)
```

Sub-files are read on demand (Read tool) when the relevant phase begins, keeping the initial context footprint small.

**Entry detection** — first action of the skill:

- `.quickstart-template` marker present → already inside a clone; proceed to interview.
- Marker absent + dir empty (or only `.git/`) → global mode: read `TEMPLATE_URL`, run `npx degit`, re-check marker, proceed.
- Marker absent + dir has unrelated content → abort with "this directory isn't empty and isn't a quickstart template clone."

**Crash recovery / idempotency.** The skill commits to git after each major phase (provisioning, subtraction, rename, scaffold). An interrupted run is recoverable manually but there is no automated resume — half-finished setup is rare and inspectable. Cloudflare resource names are deterministic (slug-based); the skill checks `wrangler d1 list` / `wrangler kv namespace list` before creating, so re-running picks up existing resources rather than duplicating.

**Self-removal.** The final commit deletes `.claude/skills/quickstart-setup/` and `.quickstart-template`. Because it is a normal commit, the user can `git revert` to restore the skill if they ever want to re-run a phase.

**Superpowers install.** The skill writes `superpowers` into the project-level `.claude/settings.json` `enabledPlugins` list, or — if the programmatic install API is not reliable in the active CC version — prints `/plugin install superpowers` for the user to run before exiting. Behavior is verified during build (Stage 3); the skill never silently fails to install.

## Interview flow

The skill executes seven phases in order. The user can abort cleanly until the **Apply** phase.

**Phase 1 — Identity (4 required answers):**
1. Display name (e.g., "Notepad")
2. Project codename / slug (default: kebab-case of display name)
3. One-sentence description
4. Brand color (hex, default `#0F172A`)

**Phase 2 — Feature toggles:**
5. OAuth providers (multi-select: `GitHub, Google, Discord, Apple, none`)
6. Use organization/teams? (Y/N)
7. Use Resend for transactional email? (Y/N — N keeps dev console logger)
8. Include the example Durable Object (real-time presence widget)? (Y/N)
9. Include vitest setup with example tests? (Y/N)
10. Set up Cloudflare Workers Git Integration for auto-deploy on push? (Y/N) — if Y, skill creates a GitHub repo (`gh repo create`) during Phase 7 *before* wiring up the integration. Requires `gh` CLI authenticated; if absent, skill prints manual setup steps and continues.

**Phase 3 — First-feature scaffold (1 answer):**
11. Describe the first feature in 1–2 sentences (e.g., *"a notes app with shared workspaces"*).

**Phase 4 — Cloudflare provisioning (skill runs commands; only asks questions if multiple accounts):**
- `wrangler whoami` (else `wrangler login`)
- pick account if multiple
- `wrangler d1 create <slug>-db` → parse + write D1 ID into `wrangler.jsonc`
- `wrangler kv namespace create <slug>-kv` → parse + write
- DO bindings written into `wrangler.jsonc` (deployed with worker; no separate creation step)
- `wrangler d1 migrations apply <slug>-db --local` runs initial Drizzle migrations

**Phase 5 — Credentials (one prompt per chosen OAuth provider + Resend):**
For each provider, skill prints the provider-console URL and the exact callback URL to register, then asks for client ID + secret. Writes to `.dev.vars` (local development only). Skipping is allowed.

Production secrets via `wrangler secret put` are **not** set during the interview — the skill writes a `scripts/deploy-secrets.sh` helper that reads `.dev.vars` and pushes each value as a production secret. The user runs this once before their first `wrangler deploy`. This separation keeps the interview focused on local-dev and avoids creating production resources before the user has confirmed they want to deploy.

**Phase 6 — Final confirmation:** Summary of what is about to be applied. User confirms.

**Phase 7 — Apply (no automated rollback; phase-by-phase commits enable manual recovery):**
1. Subtract opted-out features (delete files, strip regions, remove deps, remove env keys).
2. Rename: replace `__PROJECT_*__` sentinels.
3. Apply brand color to shadcn config.
4. Scaffold the first feature.
5. `pnpm install` to update lockfile.
6. `pnpm typecheck` to verify nothing broke.
7. Initialize fresh git repo, initial commit.
8. If Workers Git Integration was opted in: `gh repo create <slug> --private --source=. --push`, then walk through the Cloudflare dashboard step (or `wrangler` flow if available) to connect the repo. If `gh` is missing or unauthenticated, skip and print manual instructions.
9. Install superpowers plugin (or print install command).
10. Delete `.quickstart-template` marker and `.claude/skills/quickstart-setup/`. Final commit.
11. Print: *"Done. Run `pnpm dev` to start. Run `scripts/deploy-secrets.sh && wrangler deploy` when you're ready to ship."*

## Development plan

This is the order in which we *build* the template + skill. The user's stated approach: bootstrap a working reference, then reverse-engineer it into a skill.

### Stage 1 — Reference app (`/tmp/quickstart-reference/`)

Bootstrap a real, deployed full-stack app with every feature on. No toggles, no skill — just a working app. Goals:

1. Every command we will later automate (`wrangler d1 create`, `wrangler kv namespace create`, drizzle-kit migrations, `wrangler deploy`) verified end-to-end against a real Cloudflare account.
2. Every feature exercised: auth (email/password + GitHub + Google OAuth at minimum), org plugin, Resend (real send to a test inbox), KV read/write, Durable Object with a presence widget on the dashboard, vitest config running all three example tests against the workers pool.
3. Every command, file, and config decision captured in `BUILD_NOTES.md` — the source material for skill instructions.

Use `context7` for current Drizzle / D1 / better-auth / TanStack Start docs throughout, since these libraries move fast.

### Stage 2 — Templatize (`/Users/jamescary/dev/quickstart-template/`)

Take the working reference app and:

1. Rename literals to placeholder sentinels (`__PROJECT_NAME__`, `__PROJECT_SLUG__`, `__PROJECT_DESCRIPTION__`, `__BRAND_COLOR__`).
2. Wrap conditional regions with `// #region quickstart:if=X` markers (Resend, org, each OAuth provider, DO, vitest).
3. Add `.quickstart-template` marker, `install.sh`, `install.md`, `README.md`.
4. Verify the template *still runs* with all features on — `pnpm dev` and `pnpm build` clean. This is the always-on baseline.
5. Test subtraction by hand: pick a toggle, manually delete the corresponding files/regions, run typecheck. If it fails, the markers are wrong — fix and retry. Repeat for every toggle individually before automating.

### Stage 3 — Build the skill (`.claude/skills/quickstart-setup/`)

With BUILD_NOTES.md (deterministic recipe) and the manual subtraction recipe in hand, the skill becomes a translation:

1. `manifest.json` from the file/region maps validated in Stage 2.
2. `SKILL.md` + sub-files (interview, cloudflare, credentials, scaffold-feature) from BUILD_NOTES.md.
3. End-to-end test: clone the template into a scratch directory, run the skill against it with fresh Cloudflare test resources, verify the output project builds and deploys.

**Why this order:** Stage 1 de-risks unknown-unknowns (does better-auth's org plugin work on D1? do Durable Objects bind in vitest-pool-workers? what is the current TanStack Start server-functions API surface?) before locking anything into the skill. Stage 2 validates subtraction without an LLM in the loop. Stage 3 is mechanical translation of two well-tested artifacts.

## Risks

| Risk | Mitigation |
|---|---|
| Library API churn (better-auth, TanStack Start, Drizzle, Wrangler all move fast) — skill content goes stale. | Use `context7` at build time; pin versions in template `package.json`; document a quarterly re-verification cadence (schedule an agent to bump versions and re-run E2E). |
| Region-marker fragility — a missed import after subtraction breaks the build. | Stage 2 manual subtraction validates every toggle. Skill runs `pnpm typecheck` post-subtraction and aborts with a diagnostic on failure. |
| Plugin install API may differ across Claude Code versions / non-CC agents. | Detect at build time. If programmatic install isn't reliable, fall back to printing `/plugin install superpowers` — explicit, never silently broken. |
| OAuth credential collection is interactive and error-prone. | `credentials.md` shows exact callback URL + env keys per provider. Skipping allowed; user can fill in `.dev.vars` later. |
| Skill crashes mid-flow — orphaned Cloudflare resources. | Phase-by-phase git commits; deterministic resource names (slug-based); skill checks `wrangler d1 list` / `wrangler kv namespace list` before creating, picks up existing resources on re-run. |
| Real Cloudflare/Resend costs during Stage 1. | User has Workers Paid; Resend free tier; total stays under $5. |
| Cross-agent (Codex, Cursor) install.md path may behave differently from Claude Code. | Test install.md against Claude Code + Codex during Stage 3. Document known differences. |

## Open questions (resolved during build)

- Package manager: pnpm vs npm vs bun. Lean **pnpm** (TanStack Start docs use it; faster on Cloudflare CI). Confirm during Stage 1.
- vitest-pool-workers config specifics for D1 + KV + DO bindings — known-tricky; validated during Stage 1.
- Whether the superpowers plugin can be installed programmatically vs printing the install command — validated during Stage 3.
- Whether `install.sh` should attempt to install Claude Code if missing or just point at install instructions. Lean: just point.

## Success criteria

1. A test run of `install.sh my-test` followed by running the skill in Claude Code produces a project that:
   - Builds (`pnpm build` clean).
   - Typechecks (`pnpm typecheck` clean).
   - Runs locally (`pnpm dev`).
   - Deploys (`wrangler deploy` succeeds; landing page reachable).
   - Has working email/password auth.
   - Has the chosen OAuth providers wired up in code (login-page buttons present; consent screen reachable for any provider whose credentials were filled in during Phase 5).
   - Has the user-described first feature visible and functional.
2. The skill self-removes and the superpowers plugin is enabled in the resulting project.
3. Re-running the skill against an existing project aborts cleanly (entry-detection guard).
4. Manual subtraction recipes (Stage 2 output) match the skill's output file-for-file for at least three different toggle combinations.
