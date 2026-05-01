# Stage 2: Templatize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the working Stage 1 reference app (currently at `/Users/jamescary/dev/quickstart-template/reference/`) into a parametric **template at the repo root** of `/Users/jamescary/dev/quickstart-template/`. The template ships with every feature ON, builds clean as-is for typecheck purposes, and has been validated by hand to subtract cleanly for each opt-out toggle. Stage 2 outputs three artifacts: (1) the templatized source at the repo root, (2) a per-toggle subtraction recipe document that becomes the input to Stage 3's `manifest.json`, and (3) bootstrap files (`install.sh`, `install.md`, marker, user-facing README).

**Architecture:** Two-phase mechanical refactor of the reference. **Phase A (Tasks 1–6):** copy reference → root, then add `// #region quickstart:if=<toggle>` markers around feature-conditional code. The repo at this point still has literal project names ("quickstart-reference"), so `pnpm dev`, `pnpm build`, and `pnpm test` keep working as live regression gates. **Phase B (Tasks 7–11):** for each of the five toggles (`resend`, `org`, `oauth.<provider>`, `do`, `vitest`), perform the subtraction by hand (delete files, strip regions, edit JSON), run typecheck/build, and capture the exact recipe in a markdown doc. Revert after each toggle so the next test starts from a clean baseline. **Phase C (Tasks 12–14):** swap concrete project literals for `__PROJECT_*__` sentinels, add the bootstrap files, update `STATUS.md`. After Task 12 the template no longer runs (sentinels aren't valid wrangler names); typecheck remains the verification floor.

**Tech Stack:** Same as Stage 1 (TanStack Start · `@cloudflare/vite-plugin` · Drizzle ORM · `better-auth` + `better-auth-cloudflare` · Resend · Tailwind v4 + shadcn/ui · Vitest + `@cloudflare/vitest-pool-workers` · pnpm · Wrangler with `wrangler.jsonc`). No new tech is introduced in Stage 2 — this is pure refactor + region annotation + recipe capture.

**Reference inputs (read these before starting):**
- `reference/BUILD_NOTES.md` — the **Files Inventory** section (line 1028+) is the primary input. It groups every file in the reference by toggle.
- `docs/superpowers/specs/2026-04-30-quickstart-template-design.md` — the design spec; Stage 2 section starts at line 220.
- `STATUS.md` — current project status.

---

## Pre-flight checklist (run once before Task 1)

- [ ] **Verify the reference is intact and builds clean.**
  ```bash
  cd /Users/jamescary/dev/quickstart-template/reference
  pnpm install
  pnpm build
  pnpm test
  ```
  Expected: `pnpm build` produces `dist/server/index.js` + `dist/client/`; `pnpm test` reports `6 passed`. If anything fails, stop and resolve before proceeding — Stage 2 assumes Stage 1 output is good.

- [ ] **Confirm the outer template repo root is otherwise empty of code.**
  ```bash
  cd /Users/jamescary/dev/quickstart-template
  ls
  ```
  Expected output: only `STATUS.md`, `docs/`, `reference/`, `.gitignore`, `.git`. If you see `package.json`, `src/`, `node_modules/` etc. at this level, Stage 2 has already partially run — check `git log` and decide whether to rebase/restart.

- [ ] **Capture the reference's resource IDs for the conventions doc.** Read `reference/wrangler.jsonc` and note:
  - D1 `database_id`: `a5f78b53-2e29-4f68-ab1b-262df76ef691`
  - KV `id`: `5c21b215d76c49038e680801d92f5518`
  - Worker `name`: `quickstart-reference`

  These are the values you will replace with all-zero placeholders during Task 12.

- [ ] **Create a Stage 2 working notes file.**
  ```bash
  touch /Users/jamescary/dev/quickstart-template/STAGE2_NOTES.md
  ```
  Append per-task notes as you go (analogous to Stage 1's `BUILD_NOTES.md`). At the end of Stage 2 you'll merge the relevant content into the subtraction recipe doc and STATUS.md, then delete this file.

---

## Conventions (read before any task)

### Region marker syntax

A "region" is any block of file content that should be **stripped** when a toggle evaluates to false. Markers wrap the block:

| File type | Open marker | Close marker |
|---|---|---|
| `.ts` / `.tsx` / `.js` / `.jsonc` | `// #region quickstart:if=<toggle>` | `// #endregion` |
| `.env` / `.dev.vars*` / shell | `# #region quickstart:if=<toggle>` | `# #endregion` |
| `.css` | `/* #region quickstart:if=<toggle> */` | `/* #endregion */` |
| `.json` (no comments allowed) | **Cannot use regions.** Use JSON-AST edits in the manifest instead. |

Toggle names (must match exactly):
- `resend`
- `org`
- `oauth.github`
- `oauth.google`
- `do`
- `vitest`

Markers are stable text — Stage 3's skill greps for them. Do not paraphrase, do not add spaces, do not change capitalization.

**Nesting:** Allowed (e.g., a region inside another region). The skill strips outer-first.

**Adjacency rule:** A region marker line is itself stripped along with the region body. Plain comments (without `#region`) are unaffected.

### Sentinels

Replace concrete project values with these literals. They never collide with the word `quickstart`:

| Sentinel | Replaces | Where it appears |
|---|---|---|
| `__PROJECT_NAME__` | "Quickstart Reference" (display name) | dashboard layout link text, README |
| `__PROJECT_SLUG__` | "quickstart-reference" (kebab-case) | `package.json` `name`; `wrangler.jsonc` `name`; D1/KV resource names; deploy URL references in README |
| `__PROJECT_DESCRIPTION__` | one-sentence project description | `package.json` `description`; README intro; landing page `<p>` |
| `__BRAND_COLOR__` | `#0F172A` (hex) | `src/lib/auth/server.ts` invitation-email button background; eventually applied to shadcn theme by Stage 3 |

### Resource ID placeholders (not sentinels — distinct concept)

These get filled in by the Stage 3 skill at Cloudflare provisioning time, not by sentinel substitution. Use unambiguous all-zero values so a missed replacement is obvious:

| Field | Placeholder value |
|---|---|
| `wrangler.jsonc` `d1_databases[].database_id` | `00000000-0000-0000-0000-000000000000` |
| `wrangler.jsonc` `kv_namespaces[].id` | `00000000000000000000000000000000` |

Stage 3's skill overwrites these by **binding name** (`DB`, `KV`) — no detection logic needed; it always rewrites those fields.

### Verification commands (used throughout Stage 2)

After every change run, in order:
```bash
cd /Users/jamescary/dev/quickstart-template
pnpm typecheck   # never installed — actually use: pnpm exec tsc --noEmit
pnpm build       # vite build; passes regardless of wrangler.jsonc validity
pnpm test        # vitest run; only meaningful while vitest is in scope
```

> **Note on `pnpm typecheck`:** the reference's `package.json` does not define a `typecheck` script. Use `pnpm exec tsc --noEmit` instead. If you want, add `"typecheck": "tsc --noEmit"` to `package.json` `scripts` during Task 1; it's harmless.

---

## File structure (output of Stage 2)

After all tasks complete, `/Users/jamescary/dev/quickstart-template/` will contain:

```
quickstart-template/
├── README.md                              # rewritten user-facing template README (Task 13)
├── install.sh                             # curl-pipeable bootstrapper (Task 13)
├── install.md                             # agent-readable equivalent of install.sh (Task 13)
├── .quickstart-template                   # marker file (Task 13)
├── .gitignore                             # adapted (Task 1)
├── package.json                           # name → __PROJECT_SLUG__; scripts updated (Tasks 1, 12)
├── pnpm-lock.yaml                         # copied from reference (Task 1)
├── tsconfig.json                          # copied; `types` array gets vitest region (Task 6)
├── vite.config.ts                         # copied as-is (Task 1)
├── wrangler.jsonc                         # name + IDs sentinelized; DO bindings region-wrapped (Tasks 5, 12)
├── worker-configuration.d.ts              # copied (regenerated per-project by skill)
├── drizzle.config.ts                      # copied (Task 1)
├── vitest.config.ts                       # copied (deleted-whole when vitest toggle off)
├── components.json                        # copied (Task 1)
├── .dev.vars.example                      # per-toggle regions added (Tasks 2, 4)
├── src/                                   # all reference source, with regions
├── tests/                                 # whole-deletion when vitest off (Task 6)
├── drizzle/migrations/                    # copied (regenerated per-project by skill in Stage 3)
├── public/                                # copied as-is
├── docs/superpowers/                      # already exists
│   ├── specs/2026-04-30-quickstart-template-design.md
│   ├── specs/2026-05-01-stage2-subtraction-recipes.md   # NEW (Tasks 7-11)
│   └── plans/2026-05-01-stage2-templatize.md            # this file
├── reference/                             # untouched; still gitignored
└── STATUS.md                              # updated (Task 14)
```

### Per-file responsibility map (region markers + edits)

This is the high-level inventory; tasks below give concrete diffs.

| File | Toggles touching it | Edit type |
|---|---|---|
| `src/lib/auth/server.ts` | `resend`, `org`, `oauth.github`, `oauth.google` | Multiple regions (imports, env type, social block, plugin block, hook body) |
| `src/lib/auth/client.ts` | `org` | Region around `organizationClient()` |
| `src/server.ts` | `do` | Region around `PresenceDO` re-export |
| `src/routes/dashboard/route.tsx` | `org` | Region around `OrgSwitcher` import + JSX |
| `src/routes/dashboard/index.tsx` | `do` | Region around `PresenceWidget` import + JSX |
| `src/components/auth/oauth-buttons.tsx` | `oauth.github`, `oauth.google` | Region around each provider button + (when both off) the export itself |
| `src/db/schema.ts` | none directly (auth-schema regenerated by skill) | No regions; Stage 3 regenerates `auth-schema.ts` |
| `tests/auth.test.ts` | `org` | Region around the `organizations`/`members`/`invitations` array entries |
| `wrangler.jsonc` | `do` | Region around `durable_objects` and `migrations` blocks |
| `.dev.vars.example` | `resend`, `oauth.github`, `oauth.google` | Region around each block of env keys |
| `tsconfig.json` | `vitest` | Region around `@cloudflare/vitest-pool-workers` types entry (single line, but JSONC supports `// #region`) |
| `package.json` | all (deps/scripts) | **No regions** — JSON. Manifest does AST edits per recipe doc |

Whole-file deletions (no regions needed):
- `resend` off: `src/server/email.ts`
- `do` off: `src/server/presence-do.ts`, `src/components/presence-widget.tsx`, `src/routes/api/presence/$.ts`
- `org` off: `src/routes/dashboard/org/` (entire directory), `src/components/org-switcher.tsx`
- `vitest` off: `tests/` (entire directory), `vitest.config.ts`

---

## Task 1: Copy reference into template root + verify baseline

**Files:**
- Source: `/Users/jamescary/dev/quickstart-template/reference/*` (excluding dev artifacts)
- Destination: `/Users/jamescary/dev/quickstart-template/` (repo root)
- Modify: `/Users/jamescary/dev/quickstart-template/.gitignore`

- [ ] **Step 1: From the repo root, copy reference contents (sans dev artifacts and the nested git).**

  ```bash
  cd /Users/jamescary/dev/quickstart-template

  # Copy each top-level file/dir individually to avoid the nested .git, node_modules, dist, .wrangler, .tanstack, BUILD_NOTES.md, .dev.vars (real secrets), and .cta.json (scaffolder marker).
  cp reference/.dev.vars.example .dev.vars.example
  cp reference/.gitignore .gitignore.from-reference
  cp reference/components.json .
  cp reference/drizzle.config.ts .
  cp reference/package.json .
  cp reference/pnpm-lock.yaml .
  cp reference/README.md README.from-reference.md  # we'll rewrite in Task 13
  cp reference/tsconfig.json .
  cp reference/vite.config.ts .
  cp reference/vitest.config.ts .
  cp reference/worker-configuration.d.ts .
  cp reference/wrangler.jsonc .

  cp -R reference/drizzle .
  cp -R reference/public .
  cp -R reference/src .
  cp -R reference/tests .
  ```

  **Why explicit copies and not `cp -R reference/* .`:** `reference/` contains a nested `.git/`, `node_modules/`, `dist/`, `.wrangler/`, `.tanstack/`, `.vscode/`, plus `BUILD_NOTES.md`, `.dev.vars` (real Resend/Google secrets), `.cta.json` — none of which belong at the template root.

- [ ] **Step 2: Merge `.gitignore` from reference into the existing root `.gitignore`.**

  The current root `/Users/jamescary/dev/quickstart-template/.gitignore` excludes `reference/` and `.DS_Store` (see existing two-line file). The reference's `.gitignore` excludes `node_modules`, `dist`, `.dev.vars`, `.wrangler`, `.tanstack`, etc. Combine them. Replace the root `.gitignore` with:

  ```
  # The Stage 1 reference build is its own self-contained git repo.
  # Stage 2 templatized it into this repo root; reference/ stays for archival.
  reference/

  # Stage 2 working notes (deleted at end of Stage 2 — see Task 14).
  STAGE2_NOTES.md

  # Build artifacts
  node_modules
  dist
  dist-ssr
  .output
  .vinxi
  .nitro
  .tanstack
  .wrangler

  # Local env / secrets
  .env
  .dev.vars
  *.local

  # Editor / OS
  .DS_Store
  __unconfig*
  todos.json

  # Drizzle generated meta — re-generated per-environment
  drizzle/migrations/meta/
  ```

  Then delete the redundant scratch:
  ```bash
  rm /Users/jamescary/dev/quickstart-template/.gitignore.from-reference
  rm /Users/jamescary/dev/quickstart-template/README.from-reference.md
  ```

- [ ] **Step 3: Add a `typecheck` script to `package.json`.**

  Open `/Users/jamescary/dev/quickstart-template/package.json` and insert after the existing `"test:watch"` line:

  ```json
      "typecheck": "tsc --noEmit",
  ```

  This makes `pnpm typecheck` work everywhere downstream in the plan.

- [ ] **Step 4: Install dependencies at the new root.**

  ```bash
  cd /Users/jamescary/dev/quickstart-template
  pnpm install
  ```

  Expected: `Done in <Xs>` with the same package set as `reference/`. The `pnpm-lock.yaml` we copied means resolution is deterministic.

- [ ] **Step 5: Verify the all-features-on baseline builds clean.**

  ```bash
  pnpm typecheck
  pnpm build
  pnpm test
  ```

  Expected:
  - `pnpm typecheck`: no output (clean exit).
  - `pnpm build`: produces `dist/client/` and `dist/server/index.js`.
  - `pnpm test`: reports `6 passed` (the three test files: `auth.test.ts`, `kv.test.ts`, `presence.test.ts`).

  If any step fails, the most likely cause is something not copied. Compare `ls -la /Users/jamescary/dev/quickstart-template/` against `ls -la /Users/jamescary/dev/quickstart-template/reference/` and copy what's missing. **Do not proceed to Step 6 until all three pass.**

- [ ] **Step 6: Commit the baseline.**

  ```bash
  cd /Users/jamescary/dev/quickstart-template
  git add .gitignore .dev.vars.example components.json drizzle.config.ts package.json pnpm-lock.yaml tsconfig.json vite.config.ts vitest.config.ts worker-configuration.d.ts wrangler.jsonc drizzle public src tests
  git commit -m "Stage 2 Task 1: copy reference into template root (all features ON, builds clean)"
  ```

  Note: at this point the root has *literal* `quickstart-reference` strings; sentinels come in Task 12. This is intentional — it lets dev/build/test work as a regression gate during marker addition.

---

## Task 2: Add `resend` region markers

**Files:**
- Modify: `src/lib/auth/server.ts`
- Modify: `.dev.vars.example`
- Reference (no edit): `src/server/email.ts` (this file gets *deleted whole* when toggle off — no regions needed)

- [ ] **Step 1: Wrap the `createEmailer` import in `src/lib/auth/server.ts`.**

  Find this line near the top of the file (currently line 12):
  ```typescript
  import { createEmailer } from "@/server/email";
  ```

  Replace with:
  ```typescript
  // #region quickstart:if=resend
  import { createEmailer } from "@/server/email";
  // #endregion
  ```

- [ ] **Step 2: Wrap the `RESEND_*` env keys in the `AuthEnv` interface.**

  In the same file, find:
  ```typescript
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
  ```

  Replace with:
  ```typescript
    // #region quickstart:if=resend
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    // #endregion
  ```

- [ ] **Step 3: Wrap the `afterCreateInvitation` hook body that calls `emailer.send`.**

  This block lives inside the `organization()` plugin config — but the `afterCreateInvitation` hook itself is org-specific. The `resend` region inside it covers the body that *uses* the emailer. Find the hook (lines 67–84 in the reference):

  ```typescript
              afterCreateInvitation: async ({ invitation, organization, inviter }) => {
                if (!env) return; // CLI/no-runtime-env path; nothing to send
                const emailer = createEmailer(env);
                const acceptUrl = `${env.BETTER_AUTH_URL}/accept-invitation/${invitation.id}`;
                await emailer.send({
                  to: invitation.email,
                  subject: `${inviter.name ?? "Someone"} invited you to ${organization.name}`,
                  html: `
                    <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
                      <h2>You're invited to ${organization.name}</h2>
                      <p>${inviter.name ?? "A team member"} invited you to join <strong>${organization.name}</strong>.</p>
                      <p><a href="${acceptUrl}" style="display: inline-block; padding: 10px 16px; background: #0F172A; color: white; text-decoration: none; border-radius: 6px;">Accept invitation</a></p>
                      <p style="color: #666; font-size: 14px;">If the button doesn't work, copy this link: ${acceptUrl}</p>
                    </div>
                  `,
                });
              },
  ```

  This whole hook is **conditional on BOTH `org` AND `resend`**. The simplest correct approach: wrap the entire `afterCreateInvitation` property in a single `org` region (Task 3 will add this), and inside it wrap the body in a `resend` region.

  For Task 2 (resend), wrap **only the function body** (after `=> {` and before the trailing `},` for the property). Keep the property declaration so it can be wholly removed in Task 3 along with the rest of the hook. Replace the hook body with:

  ```typescript
              afterCreateInvitation: async ({ invitation, organization, inviter }) => {
                // #region quickstart:if=resend
                if (!env) return; // CLI/no-runtime-env path; nothing to send
                const emailer = createEmailer(env);
                const acceptUrl = `${env.BETTER_AUTH_URL}/accept-invitation/${invitation.id}`;
                await emailer.send({
                  to: invitation.email,
                  subject: `${inviter.name ?? "Someone"} invited you to ${organization.name}`,
                  html: `
                    <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
                      <h2>You're invited to ${organization.name}</h2>
                      <p>${inviter.name ?? "A team member"} invited you to join <strong>${organization.name}</strong>.</p>
                      <p><a href="${acceptUrl}" style="display: inline-block; padding: 10px 16px; background: #0F172A; color: white; text-decoration: none; border-radius: 6px;">Accept invitation</a></p>
                      <p style="color: #666; font-size: 14px;">If the button doesn't work, copy this link: ${acceptUrl}</p>
                    </div>
                  `,
                });
                // #endregion
              },
  ```

  **Why nest this way:** when `org` is off, the entire org plugin block (containing the hook) gets stripped — nothing referencing `createEmailer` remains. When `org` is on but `resend` is off, the hook stays but its body is empty (no-op invitations are still created in the DB; the email send is silently skipped). Stage 3's skill can replace the empty body with a console.log fallback if desired; for now, an empty body is acceptable behavior.

- [ ] **Step 4: Wrap the `RESEND_*` block in `.dev.vars.example`.**

  Open `/Users/jamescary/dev/quickstart-template/.dev.vars.example`. Find:
  ```
  RESEND_API_KEY=
  # Resend test sender — only delivers to your Resend account email.
  # For production, verify a domain at https://resend.com/domains and use noreply@<your-domain>.
  RESEND_FROM_EMAIL=onboarding@resend.dev
  ```

  Replace with:
  ```
  # #region quickstart:if=resend
  RESEND_API_KEY=
  # Resend test sender — only delivers to your Resend account email.
  # For production, verify a domain at https://resend.com/domains and use noreply@<your-domain>.
  RESEND_FROM_EMAIL=onboarding@resend.dev
  # #endregion
  ```

- [ ] **Step 5: Verify the baseline still builds.**

  ```bash
  cd /Users/jamescary/dev/quickstart-template
  pnpm typecheck
  pnpm build
  pnpm test
  ```

  All three must pass. Region markers are pure comments — code behavior is unchanged. If anything fails, you've introduced a stray syntax error; review the diff.

- [ ] **Step 6: Commit.**

  ```bash
  git add src/lib/auth/server.ts .dev.vars.example
  git commit -m "Stage 2 Task 2: add resend region markers"
  ```

---

## Task 3: Add `org` region markers

**Files:**
- Modify: `src/lib/auth/server.ts`
- Modify: `src/lib/auth/client.ts`
- Modify: `src/routes/dashboard/route.tsx`
- Modify: `tests/auth.test.ts`
- Reference (no edit; whole-deletion in subtraction): `src/routes/dashboard/org/index.tsx`, `src/routes/dashboard/org/invite.tsx`, `src/components/org-switcher.tsx`

- [ ] **Step 1: Wrap the `organization` import + plugin entry in `src/lib/auth/server.ts`.**

  Find:
  ```typescript
  import { organization } from "better-auth/plugins";
  ```

  Replace with:
  ```typescript
  // #region quickstart:if=org
  import { organization } from "better-auth/plugins";
  // #endregion
  ```

  Find the `plugins` array (lines ~64–86):
  ```typescript
          plugins: [
            organization({
              organizationHooks: {
                afterCreateInvitation: async ({ invitation, organization, inviter }) => {
                  // ... (resend region from Task 2)
                },
              },
            }),
          ],
  ```

  Replace with (note the `org` region wraps the entire `organization({...})` call but **not** the surrounding `plugins: []` declaration — the array stays even if empty, since other plugins may be added later by user code):
  ```typescript
          plugins: [
            // #region quickstart:if=org
            organization({
              organizationHooks: {
                afterCreateInvitation: async ({ invitation, organization, inviter }) => {
                  // #region quickstart:if=resend
                  // ... (existing resend region from Task 2 — keep as-is)
                  // #endregion
                },
              },
            }),
            // #endregion
          ],
  ```

  **Important:** preserve the resend nested region inside the hook body. Do not remove it.

- [ ] **Step 2: Wrap the `organizationClient` import + plugin entry in `src/lib/auth/client.ts`.**

  The full file (12 lines) is:
  ```typescript
  import { createAuthClient } from "better-auth/react";
  import { organizationClient } from "better-auth/client/plugins";

  export const authClient = createAuthClient({
    baseURL:
      typeof window === "undefined"
        ? (import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000")
        : window.location.origin,
    plugins: [organizationClient()],
  });

  export const { signIn, signOut, signUp, useSession } = authClient;
  ```

  Replace with:
  ```typescript
  import { createAuthClient } from "better-auth/react";
  // #region quickstart:if=org
  import { organizationClient } from "better-auth/client/plugins";
  // #endregion

  export const authClient = createAuthClient({
    baseURL:
      typeof window === "undefined"
        ? (import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000")
        : window.location.origin,
    plugins: [
      // #region quickstart:if=org
      organizationClient(),
      // #endregion
    ],
  });

  export const { signIn, signOut, signUp, useSession } = authClient;
  ```

- [ ] **Step 3: Wrap the `OrgSwitcher` import + JSX in `src/routes/dashboard/route.tsx`.**

  Find:
  ```typescript
  import { OrgSwitcher } from "@/components/org-switcher";
  ```

  Replace with:
  ```typescript
  // #region quickstart:if=org
  import { OrgSwitcher } from "@/components/org-switcher";
  // #endregion
  ```

  Find inside `DashboardLayout`:
  ```jsx
          <div className="flex items-center gap-2">
            <OrgSwitcher />
            <ThemeToggle />
  ```

  Replace with:
  ```jsx
          <div className="flex items-center gap-2">
            {/* #region quickstart:if=org */}
            <OrgSwitcher />
            {/* #endregion */}
            <ThemeToggle />
  ```

  **Note on JSX comment syntax:** in JSX-text positions, `// #region` is not valid (it would render as text). Use `{/* #region quickstart:if=<toggle> */}` and `{/* #endregion */}` instead. Stage 3's skill must recognize both forms. Document this in Step 7's commit message.

- [ ] **Step 4: Wrap the org-table assertions in `tests/auth.test.ts`.**

  Find:
  ```typescript
      const tables = ["users", "sessions", "accounts", "verifications", "organizations", "members", "invitations"];
  ```

  Replace with:
  ```typescript
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
  ```

  This makes the array literal multi-line and lets the region strip the three org table names cleanly. The remaining four-element array is still valid TypeScript.

- [ ] **Step 5: Verify the baseline still builds and tests still pass.**

  ```bash
  pnpm typecheck && pnpm build && pnpm test
  ```

  All must pass.

- [ ] **Step 6: Commit.**

  ```bash
  git add src/lib/auth/server.ts src/lib/auth/client.ts src/routes/dashboard/route.tsx tests/auth.test.ts
  git commit -m "Stage 2 Task 3: add org region markers (incl. JSX {/* #region */} variant)"
  ```

---

## Task 4: Add `oauth.<provider>` region markers (GitHub + Google)

**Files:**
- Modify: `src/lib/auth/server.ts`
- Modify: `src/components/auth/oauth-buttons.tsx`
- Modify: `.dev.vars.example`

- [ ] **Step 1: Wrap each `<PROVIDER>_*` env key pair in `AuthEnv` (`src/lib/auth/server.ts`).**

  Find:
  ```typescript
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  ```

  Replace with:
  ```typescript
    // #region quickstart:if=oauth.github
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    // #endregion
    // #region quickstart:if=oauth.google
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    // #endregion
  ```

- [ ] **Step 2: Wrap each provider's `social.<provider>` assignment block.**

  Find inside `createAuth`:
  ```typescript
    const social: Record<string, { clientId: string; clientSecret: string }> = {};
    if (env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET) {
      social.github = {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      };
    }
    if (env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET) {
      social.google = {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      };
    }
  ```

  Replace with:
  ```typescript
    const social: Record<string, { clientId: string; clientSecret: string }> = {};
    // #region quickstart:if=oauth.github
    if (env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET) {
      social.github = {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      };
    }
    // #endregion
    // #region quickstart:if=oauth.google
    if (env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET) {
      social.google = {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      };
    }
    // #endregion
  ```

  When a provider is off, the strip removes both the env-type entry and the runtime conditional. The empty `social` object is still valid (no providers configured).

- [ ] **Step 3: Wrap each button in `src/components/auth/oauth-buttons.tsx`.**

  Replace the entire file content with:

  ```typescript
  import { signIn } from "@/lib/auth/client";
  import { Button } from "@/components/ui/button";

  export function OAuthButtons() {
    return (
      <div className="flex flex-col gap-2">
        {/* #region quickstart:if=oauth.github */}
        <Button
          type="button"
          variant="outline"
          onClick={() => signIn.social({ provider: "github", callbackURL: "/dashboard" })}
        >
          Continue with GitHub
        </Button>
        {/* #endregion */}
        {/* #region quickstart:if=oauth.google */}
        <Button
          type="button"
          variant="outline"
          onClick={() => signIn.social({ provider: "google", callbackURL: "/dashboard" })}
        >
          Continue with Google
        </Button>
        {/* #endregion */}
      </div>
    );
  }
  ```

  **Note: when both OAuth providers are off**, the `OAuthButtons` component still exists and renders an empty `<div>`. The login/signup pages still import and mount it. This is acceptable — empty div is harmless. Alternatively, Stage 3's skill can choose to delete `oauth-buttons.tsx` entirely and strip its imports + JSX in `login.tsx` / `signup.tsx` when neither provider is selected. **Stage 2 does not encode that combinatorial logic** — the recipe doc (Task 9) just notes it.

- [ ] **Step 4: Wrap each provider's env keys in `.dev.vars.example`.**

  Find:
  ```
  GITHUB_CLIENT_ID=
  GITHUB_CLIENT_SECRET=
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  ```

  Replace with:
  ```
  # #region quickstart:if=oauth.github
  GITHUB_CLIENT_ID=
  GITHUB_CLIENT_SECRET=
  # #endregion
  # #region quickstart:if=oauth.google
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  # #endregion
  ```

- [ ] **Step 5: Verify the baseline.**

  ```bash
  pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 6: Commit.**

  ```bash
  git add src/lib/auth/server.ts src/components/auth/oauth-buttons.tsx .dev.vars.example
  git commit -m "Stage 2 Task 4: add oauth.github + oauth.google region markers"
  ```

---

## Task 5: Add `do` region markers

**Files:**
- Modify: `src/server.ts`
- Modify: `src/routes/dashboard/index.tsx`
- Modify: `wrangler.jsonc`
- Reference (no edit; whole-deletion in subtraction): `src/server/presence-do.ts`, `src/components/presence-widget.tsx`, `src/routes/api/presence/$.ts`

- [ ] **Step 1: Wrap the DO re-export in `src/server.ts`.**

  Replace the file content with:
  ```typescript
  import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

  // #region quickstart:if=do
  // Re-export DurableObject classes so wrangler can register them.
  // This is the TanStack Start documented pattern for DOs/queues/scheduled events.
  export { PresenceDO } from "./server/presence-do";
  // #endregion

  export default createServerEntry({
    fetch(request) {
      return handler.fetch(request);
    },
  });
  ```

- [ ] **Step 2: Wrap the `PresenceWidget` mount in `src/routes/dashboard/index.tsx`.**

  Replace the file content with:
  ```typescript
  import { createFileRoute } from "@tanstack/react-router";
  import { useSession } from "@/lib/auth/client";
  // #region quickstart:if=do
  import { PresenceWidget } from "@/components/presence-widget";
  // #endregion

  export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

  function DashboardHome() {
    const { data: session, isPending } = useSession();
    if (isPending || !session) return <p>Loading...</p>;
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Welcome, {session?.user.name}</h2>
          <p className="text-muted-foreground">{session?.user.email}</p>
        </div>
        {/* #region quickstart:if=do */}
        <PresenceWidget />
        {/* #endregion */}
      </div>
    );
  }
  ```

- [ ] **Step 3: Wrap the DO blocks in `wrangler.jsonc`.**

  `wrangler.jsonc` currently contains:
  ```jsonc
    "durable_objects": {
      "bindings": [
        { "name": "PRESENCE", "class_name": "PresenceDO" }
      ]
    },
    "migrations": [
      { "tag": "v1", "new_sqlite_classes": ["PresenceDO"] }
    ]
  ```

  Replace with:
  ```jsonc
    // #region quickstart:if=do
    "durable_objects": {
      "bindings": [
        { "name": "PRESENCE", "class_name": "PresenceDO" }
      ]
    },
    "migrations": [
      { "tag": "v1", "new_sqlite_classes": ["PresenceDO"] }
    ]
    // #endregion
  ```

  **Trailing-comma trap:** if these blocks are followed by another property in the JSON object, the comma between them must remain valid after stripping. In the reference's `wrangler.jsonc` the `migrations` block is the **last property** in the root object — no trailing comma to worry about. If you've already added or rearranged properties, ensure the line before the `// #region` does not end with a stranded comma after the strip.

- [ ] **Step 4: Verify the baseline.**

  ```bash
  pnpm typecheck && pnpm build && pnpm test
  ```

  All three must pass. The DO test (`tests/presence.test.ts`) still runs because the binding is still in `wrangler.jsonc`.

- [ ] **Step 5: Commit.**

  ```bash
  git add src/server.ts src/routes/dashboard/index.tsx wrangler.jsonc
  git commit -m "Stage 2 Task 5: add do region markers (server.ts, dashboard, wrangler.jsonc)"
  ```

---

## Task 6: Add `vitest` region markers

**Files:**
- Modify: `tsconfig.json`
- Reference (no edit; whole-deletion in subtraction): `tests/`, `vitest.config.ts`. Plus `package.json` deps and scripts (handled by manifest JSON-AST edits, not regions).

- [ ] **Step 1: Wrap the vitest types entry in `tsconfig.json`.**

  Find:
  ```json
      "types": ["vite/client", "@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"],
  ```

  Replace with the multi-line equivalent so we can wrap the vitest entry:
  ```jsonc
      "types": [
        "vite/client",
        "@cloudflare/workers-types",
        // #region quickstart:if=vitest
        "@cloudflare/vitest-pool-workers"
        // #endregion
      ],
  ```

  **JSON-vs-JSONC note:** The default file extension is `.json`, but TypeScript's parser accepts JSONC-style `//` comments in `tsconfig.json` even with the `.json` extension. The skill's region-stripper must therefore tolerate `// #region` in `tsconfig.json` despite the extension. Document this in Step 3's commit.

  **Trailing comma:** stripping the region leaves the array as `["vite/client", "@cloudflare/workers-types"]` (well-formed). No comma fix required here because the vitest entry is last in the array.

- [ ] **Step 2: Verify the baseline.**

  ```bash
  pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 3: Commit.**

  ```bash
  git add tsconfig.json
  git commit -m "Stage 2 Task 6: add vitest region marker in tsconfig.json (tests/ + vitest.config.ts are whole-file deletions)"
  ```

---

## Task 7: Manual subtraction recipe — `resend` off

**Goal:** validate that with the `resend` region markers in place, an actual subtraction (delete files, strip regions, edit JSON) leaves the project in a buildable state. Capture the recipe, then revert.

**Files:**
- Create: `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`
- Temporarily modify: many files (subtraction); reverted at end of task

- [ ] **Step 1: Stash a clean baseline.**

  ```bash
  cd /Users/jamescary/dev/quickstart-template
  git status   # confirm clean tree
  ```

  Expected: "nothing to commit, working tree clean." If not clean, commit or stash before proceeding.

- [ ] **Step 2: Perform the `resend` subtraction by hand.**

  - Delete `src/server/email.ts`:
    ```bash
    rm src/server/email.ts
    ```
  - Strip every `// #region quickstart:if=resend` ... `// #endregion` block (including the marker lines themselves) from:
    - `src/lib/auth/server.ts`
    - `.dev.vars.example`

    Use this regex pattern as a guide; the skill in Stage 3 will automate it. For Stage 2, do it manually with Edit:
    - Open the file, find the `// #region quickstart:if=resend` line, delete from that line through and including the matching `// #endregion` line.
  - Edit `package.json`: remove `"resend": "^6.12.2"` from `dependencies`.

- [ ] **Step 3: Run the verification gate.**

  ```bash
  pnpm install   # updates lockfile after dep removal
  pnpm typecheck
  pnpm build
  pnpm test
  ```

  Expected: all four steps pass. If `pnpm test` reports a failure related to invitations or Resend, that's a recipe gap — investigate and update the recipe (likely you missed a region or a test reference).

- [ ] **Step 4: Capture the recipe.**

  Create `/Users/jamescary/dev/quickstart-template/docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md` with this header (you'll append to it in Tasks 8–11):

  ```markdown
  # Stage 2 Subtraction Recipes

  **Source:** Hand-validated during Stage 2 (Tasks 7–11). One recipe per toggle. Each recipe was applied to the all-features-on template at `/Users/jamescary/dev/quickstart-template/`, verified via `pnpm typecheck && pnpm build && pnpm test`, then reverted before the next recipe.

  **For Stage 3:** these recipes are the source of truth for `manifest.json`. Each recipe maps 1:1 to a manifest entry. JSON edits are explicit (the skill needs JSON-AST handling); region strips and whole-file deletions are mechanical greps.

  **Marker convention:**
  - TS/JS/JSONC: `// #region quickstart:if=<toggle>` ... `// #endregion`
  - JSX text positions: `{/* #region quickstart:if=<toggle> */}` ... `{/* #endregion */}`
  - .env / shell: `# #region quickstart:if=<toggle>` ... `# #endregion`
  - Strip removes the marker lines themselves.

  ---

  ## Toggle: `resend`

  **Validated:** YYYY-MM-DD against template at commit `<HEAD before subtraction>`.

  **Whole-file deletions:**
  - `src/server/email.ts`

  **Region strips (file → tag):**
  - `src/lib/auth/server.ts`: `resend` (3 regions: import, AuthEnv keys, hook body)
  - `.dev.vars.example`: `resend` (1 region)

  **JSON edits:**
  - `package.json` `dependencies`: remove key `resend`.

  **Verification (post-subtraction):** `pnpm install && pnpm typecheck && pnpm build && pnpm test` — all pass with N tests passing (auth, kv, presence).

  **Notes:**
  - The `afterCreateInvitation` hook body becomes empty after strip. This is acceptable — invitation rows are still created in the DB, only the email send is skipped. Stage 3 may choose to insert a `console.log` fallback in the empty body.
  ```

  Replace `YYYY-MM-DD` with today's date and `<HEAD before subtraction>` with the SHA from `git rev-parse HEAD` (run before Step 2 — capture from the previous Task 6 commit).

- [ ] **Step 5: Revert the subtraction.**

  ```bash
  git restore --source=HEAD --staged --worktree -- src/server/email.ts src/lib/auth/server.ts .dev.vars.example package.json
  pnpm install   # restore lockfile to all-features-on state
  ```

  Verify clean revert:
  ```bash
  git status     # should show only the new docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md
  pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 6: Commit the recipe doc.**

  ```bash
  git add docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md
  git commit -m "Stage 2 Task 7: validate resend subtraction recipe"
  ```

---

## Task 8: Manual subtraction recipe — `org` off

**Files:**
- Append: `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`
- Temporarily modify: many files; reverted at end

- [ ] **Step 1: Confirm clean baseline.**

  ```bash
  git status        # clean
  pnpm typecheck && pnpm build && pnpm test     # all pass
  ```

- [ ] **Step 2: Perform the `org` subtraction by hand.**

  - Delete:
    ```bash
    rm -rf src/routes/dashboard/org
    rm src/components/org-switcher.tsx
    ```
  - Strip every `// #region quickstart:if=org` block (TS variant) and every `{/* #region quickstart:if=org */}` block (JSX variant) from:
    - `src/lib/auth/server.ts` (2 regions: import, plugin entry)
    - `src/lib/auth/client.ts` (2 regions: import, plugin entry)
    - `src/routes/dashboard/route.tsx` (2 regions: import, JSX mount)
    - `tests/auth.test.ts` (1 region: org-table assertions)
  - **Note:** `src/db/auth-schema.ts` still defines `organizations`, `members`, `invitations` tables. We do **not** delete these in Stage 2 — Stage 3 regenerates `auth-schema.ts` via `@better-auth/cli generate` after stripping the `organization()` plugin from `auth.ts`. The org tables surviving in the schema is harmless (drizzle-kit will reflect them in migrations; tests query them; no runtime use).

- [ ] **Step 3: Verify.**

  ```bash
  pnpm typecheck
  pnpm build
  pnpm test
  ```

  Expected: all pass. If `tests/auth.test.ts` fails, the org-table region wasn't stripped correctly — check the diff.

- [ ] **Step 4: Append to the recipe doc.**

  Append this section to `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`:

  ```markdown
  ---

  ## Toggle: `org`

  **Validated:** YYYY-MM-DD against template at commit `<HEAD before subtraction>`.

  **Whole-file/dir deletions:**
  - `src/routes/dashboard/org/` (entire directory: `index.tsx`, `invite.tsx`)
  - `src/components/org-switcher.tsx`

  **Region strips (file → tag):**
  - `src/lib/auth/server.ts`: `org` (2 regions: import, plugin block — note the nested `resend` region inside the hook is also removed transitively when its parent `org` region is stripped)
  - `src/lib/auth/client.ts`: `org` (2 regions: import, plugin entry)
  - `src/routes/dashboard/route.tsx`: `org` (2 regions: import, JSX mount)
  - `tests/auth.test.ts`: `org` (1 region: org-table assertions)

  **JSON edits:** none. (`@better-auth/drizzle-adapter` is still needed for the base auth tables; the `better-auth/plugins` import path stays in dep tree via the package.)

  **Schema regen (Stage 3 only):** the org tables persist in `src/db/auth-schema.ts` after Stage 2 subtraction. Stage 3's skill regenerates this file via `pnpm exec @better-auth/cli generate` *after* stripping the `organization()` plugin from `auth.ts`. The CLI emits only the plugins still present in `createAuth`. **For Stage 2 validation purposes, leaving the org tables in `auth-schema.ts` is acceptable** — they compile fine (no runtime references) and tests still query them (and they exist in the test D1 because migrations include them).

  **Verification (post-subtraction):** `pnpm typecheck && pnpm build && pnpm test` all pass with N tests passing.
  ```

- [ ] **Step 5: Revert.**

  ```bash
  git restore --source=HEAD --staged --worktree -- src/lib/auth/server.ts src/lib/auth/client.ts src/routes/dashboard/route.tsx tests/auth.test.ts
  git checkout HEAD -- src/routes/dashboard/org src/components/org-switcher.tsx
  ```

  Verify:
  ```bash
  git status   # only the recipe doc shows modified
  pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 6: Commit.**

  ```bash
  git add docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md
  git commit -m "Stage 2 Task 8: validate org subtraction recipe"
  ```

---

## Task 9: Manual subtraction recipe — `oauth.github` off (GitHub-only test)

We need to test removing **one** OAuth provider while leaving another in place. Pick `oauth.github` (Google stays). The `oauth.google` recipe is symmetric — we capture both in the doc but only validate one end-to-end.

**Files:**
- Append: `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`
- Temporarily modify: many files; reverted at end

- [ ] **Step 1: Confirm clean baseline.**

  ```bash
  git status && pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 2: Perform the `oauth.github` subtraction by hand.**

  - Strip every `// #region quickstart:if=oauth.github` block (and JSX variant) from:
    - `src/lib/auth/server.ts` (2 regions: AuthEnv keys, social.github block)
    - `src/components/auth/oauth-buttons.tsx` (1 region: GitHub button)
    - `.dev.vars.example` (1 region: GITHUB_* keys)
  - No file deletions, no JSON edits.

- [ ] **Step 3: Verify.**

  ```bash
  pnpm typecheck && pnpm build && pnpm test
  ```

  All pass.

- [ ] **Step 4: Append to recipe doc.**

  Append:

  ```markdown
  ---

  ## Toggle: `oauth.github` (validated)

  **Validated:** YYYY-MM-DD.

  **Whole-file deletions:** none.

  **Region strips (file → tag):**
  - `src/lib/auth/server.ts`: `oauth.github` (2 regions: AuthEnv keys, social.github block)
  - `src/components/auth/oauth-buttons.tsx`: `oauth.github` (1 region: button JSX)
  - `.dev.vars.example`: `oauth.github` (1 region: env keys)

  **JSON edits:** none.

  **Verification:** `pnpm typecheck && pnpm build && pnpm test` pass.

  ---

  ## Toggle: `oauth.google` (mirror — not separately validated)

  Symmetric to `oauth.github`:

  **Region strips (file → tag):**
  - `src/lib/auth/server.ts`: `oauth.google` (2 regions: AuthEnv keys, social.google block)
  - `src/components/auth/oauth-buttons.tsx`: `oauth.google` (1 region: button JSX)
  - `.dev.vars.example`: `oauth.google` (1 region: env keys)

  ---

  ## Combined: BOTH OAuth providers off

  When neither `oauth.github` nor `oauth.google` is selected, the result of stripping both regions is:

  - `src/lib/auth/server.ts`: AuthEnv has no provider keys; `social` object is `{}`; `socialProviders: social` still works (better-auth accepts empty `{}`).
  - `src/components/auth/oauth-buttons.tsx`: `OAuthButtons` returns `<div className="flex flex-col gap-2"></div>` (empty).
  - `.dev.vars.example`: no provider sections.
  - `src/routes/login.tsx` and `src/routes/signup.tsx`: still import and mount `OAuthButtons` — the empty div renders the "or" divider above an empty space. Acceptable but visually awkward.

  **Stage 3 enhancement (deferred from Stage 2):** when both providers are off, the skill may additionally:
  - Delete `src/components/auth/oauth-buttons.tsx`
  - Strip the `OAuthButtons` import + `<OAuthButtons />` JSX (and the `<div className="my-4 text-center text-xs text-muted-foreground">or</div>` divider) from `login.tsx` and `signup.tsx`.

  This combinatorial cleanup is **not** encoded as Stage 2 region markers (would require multi-toggle conditional logic). The skill performs it as a post-subtraction pass when both `oauth.*` toggles resolve false.
  ```

- [ ] **Step 5: Revert.**

  ```bash
  git restore --source=HEAD --staged --worktree -- src/lib/auth/server.ts src/components/auth/oauth-buttons.tsx .dev.vars.example
  pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 6: Commit.**

  ```bash
  git add docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md
  git commit -m "Stage 2 Task 9: validate oauth.github subtraction; mirror google + both-off notes"
  ```

---

## Task 10: Manual subtraction recipe — `do` off

**Files:**
- Append: `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`
- Temporarily modify: many files including `wrangler.jsonc`; reverted at end. **Also: `tests/presence.test.ts` will be deleted as part of the subtraction**, since it imports `PresenceDO` directly.

- [ ] **Step 1: Confirm clean baseline.**

  ```bash
  git status && pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 2: Perform the `do` subtraction by hand.**

  - Delete:
    ```bash
    rm src/server/presence-do.ts
    rm src/components/presence-widget.tsx
    rm src/routes/api/presence/\$.ts
    rmdir src/routes/api/presence
    rm tests/presence.test.ts
    rm tests/worker-entry.ts   # only useful for the DO; vitest would otherwise import it for the DO export
    ```

    **Why delete `tests/worker-entry.ts`:** the file's only purpose is to export `PresenceDO` so `runInDurableObject()` can find it. With no DO, the file's not needed. **But** `vitest.config.ts` references it via `cloudflareTest({ main: "./tests/worker-entry.ts" })`. Replace it with a minimal stub so vitest still has a `main` path:

    ```bash
    cat > tests/worker-entry.ts <<'EOF'
    // Minimal worker entry for vitest-pool-workers.
    export default {
      fetch() {
        return new Response("test-worker");
      },
    };
    EOF
    ```

    (Yes — keep `tests/worker-entry.ts` but strip the DO export. Easier than removing references in vitest.config.ts.)

  - Strip `// #region quickstart:if=do` regions from:
    - `src/server.ts` (1 region: PresenceDO re-export)
    - `src/routes/dashboard/index.tsx` (2 regions: import, JSX mount)
  - Strip `// #region quickstart:if=do` from `wrangler.jsonc` (1 region: `durable_objects` + `migrations` blocks).

- [ ] **Step 3: Verify.**

  ```bash
  pnpm typecheck && pnpm build && pnpm test
  ```

  Expected: typecheck and build pass. `pnpm test` should report **4 tests passing** (auth: 2, kv: 2; presence: deleted). If a test references `env.PRESENCE` and fails, the wrangler.jsonc strip may have left a stale `worker-configuration.d.ts`; regenerate types:
  ```bash
  pnpx wrangler types
  pnpm typecheck
  ```

- [ ] **Step 4: Append to recipe doc.**

  Append:

  ```markdown
  ---

  ## Toggle: `do`

  **Validated:** YYYY-MM-DD.

  **Whole-file deletions:**
  - `src/server/presence-do.ts`
  - `src/components/presence-widget.tsx`
  - `src/routes/api/presence/$.ts` (and the empty `src/routes/api/presence/` directory)
  - `tests/presence.test.ts`

  **File replacements (skill rewrites):**
  - `tests/worker-entry.ts`: rewrite to a minimal stub (no DO exports). Stage 3's manifest entry should be a `replace` op, not a delete.

  **Region strips (file → tag):**
  - `src/server.ts`: `do` (1 region)
  - `src/routes/dashboard/index.tsx`: `do` (2 regions: import, JSX mount)
  - `wrangler.jsonc`: `do` (1 region: `durable_objects` + `migrations` blocks)

  **JSON edits:** none. (DO config is in `wrangler.jsonc` which uses regions.)

  **Worker type regeneration required:** Stage 3 must run `pnpm exec wrangler types` after stripping `wrangler.jsonc` regions, otherwise `worker-configuration.d.ts` retains stale `PRESENCE` binding type.

  **Verification:** `pnpm typecheck && pnpm build && pnpm test` pass with 4 tests (auth: 2, kv: 2).
  ```

- [ ] **Step 5: Revert.**

  ```bash
  git checkout HEAD -- src/server/presence-do.ts src/components/presence-widget.tsx src/routes/api/presence/\$.ts tests/presence.test.ts tests/worker-entry.ts
  git restore --source=HEAD --staged --worktree -- src/server.ts src/routes/dashboard/index.tsx wrangler.jsonc
  # Regenerate types if you re-ran wrangler types during the subtraction:
  pnpx wrangler types
  pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 6: Commit.**

  ```bash
  git add docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md
  git commit -m "Stage 2 Task 10: validate do subtraction recipe"
  ```

---

## Task 11: Manual subtraction recipe — `vitest` off

**Files:**
- Append: `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`
- Temporarily modify: many files; reverted at end

- [ ] **Step 1: Confirm clean baseline.**

  ```bash
  git status && pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 2: Perform the `vitest` subtraction by hand.**

  - Delete:
    ```bash
    rm -rf tests
    rm vitest.config.ts
    ```
  - Strip `// #region quickstart:if=vitest` from `tsconfig.json`.
  - Edit `package.json`:
    - Remove from `scripts`: `"test"` and `"test:watch"`.
    - Remove from `devDependencies`: `@cloudflare/vitest-pool-workers`, `@testing-library/dom`, `@testing-library/react`, `jsdom`, `vitest`.

- [ ] **Step 3: Verify.**

  ```bash
  pnpm install
  pnpm typecheck
  pnpm build
  ```

  Expected: install + typecheck + build pass. `pnpm test` is intentionally absent (no `test` script). If typecheck fails with "Cannot find type definition file for '@cloudflare/vitest-pool-workers'", the `tsconfig.json` types entry wasn't stripped — re-check Task 6's region marker.

- [ ] **Step 4: Append to recipe doc.**

  ```markdown
  ---

  ## Toggle: `vitest`

  **Validated:** YYYY-MM-DD.

  **Whole-file/dir deletions:**
  - `tests/` (entire directory)
  - `vitest.config.ts`

  **Region strips (file → tag):**
  - `tsconfig.json`: `vitest` (1 region: types array entry)

  **JSON edits:**
  - `package.json` `scripts`: remove keys `test`, `test:watch`.
  - `package.json` `devDependencies`: remove keys `@cloudflare/vitest-pool-workers`, `@testing-library/dom`, `@testing-library/react`, `jsdom`, `vitest`.

  **Verification:** `pnpm install && pnpm typecheck && pnpm build` pass; no `pnpm test` script.
  ```

- [ ] **Step 5: Revert.**

  ```bash
  git checkout HEAD -- tests vitest.config.ts tsconfig.json package.json
  pnpm install
  pnpm typecheck && pnpm build && pnpm test
  ```

- [ ] **Step 6: Commit.**

  ```bash
  git add docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md
  git commit -m "Stage 2 Task 11: validate vitest subtraction recipe"
  ```

---

## Task 12: Replace literals with sentinels

After this task, the template **no longer runs** as-is (`pnpm dev` will fail because `__PROJECT_SLUG__` is not a valid wrangler worker name). Typecheck and `pnpm build` (vite-only) remain the verification floor.

**Files:**
- Modify: `package.json`, `wrangler.jsonc`, `README.md`, `src/routes/dashboard/route.tsx`, `src/lib/auth/server.ts`, plus any other place the literals appear.

- [ ] **Step 1: Inventory all occurrences of literals.**

  ```bash
  cd /Users/jamescary/dev/quickstart-template
  grep -rn "quickstart-reference\|Quickstart Reference\|0F172A" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.jsonc" --include="*.css" --include="*.md" .
  ```

  Confirm the set matches what was found during plan-writing (see Conventions section). Expected hits:
  - `package.json` lines 2, 16, 17 (`name`, `db:migrate:local`, `db:migrate:remote`)
  - `wrangler.jsonc` lines 3, 15 (`name`, `database_name`)
  - `src/routes/dashboard/route.tsx` line 35 (`Quickstart Reference` link text)
  - `src/lib/auth/server.ts` line ~78 (`#0F172A` hex in invitation email)
  - `README.md` (Task 13 will rewrite this; skip for now)

  If `grep` reports anything else, add it to the replacement plan.

- [ ] **Step 2: Replace literals in `package.json`.**

  Open `/Users/jamescary/dev/quickstart-template/package.json`:
  - `"name": "quickstart-reference"` → `"name": "__PROJECT_SLUG__"`
  - `"db:migrate:local": "wrangler d1 migrations apply quickstart-reference-db --local"` → `"db:migrate:local": "wrangler d1 migrations apply __PROJECT_SLUG__-db --local"`
  - `"db:migrate:remote": "wrangler d1 migrations apply quickstart-reference-db --remote"` → `"db:migrate:remote": "wrangler d1 migrations apply __PROJECT_SLUG__-db --remote"`

  Add a `description` field if absent:
  ```json
    "description": "__PROJECT_DESCRIPTION__",
  ```

- [ ] **Step 3: Replace literals + IDs in `wrangler.jsonc`.**

  Open `/Users/jamescary/dev/quickstart-template/wrangler.jsonc`:
  - `"name": "quickstart-reference"` → `"name": "__PROJECT_SLUG__"`
  - In `d1_databases[0]`:
    - `"database_name": "quickstart-reference-db"` → `"database_name": "__PROJECT_SLUG__-db"`
    - `"database_id": "a5f78b53-2e29-4f68-ab1b-262df76ef691"` → `"database_id": "00000000-0000-0000-0000-000000000000"`
  - In `kv_namespaces[0]`:
    - `"id": "5c21b215d76c49038e680801d92f5518"` → `"id": "00000000000000000000000000000000"`

- [ ] **Step 4: Replace the dashboard layout link text.**

  Open `src/routes/dashboard/route.tsx`. Find:
  ```jsx
            Quickstart Reference
  ```

  Replace with:
  ```jsx
            __PROJECT_NAME__
  ```

- [ ] **Step 5: Replace the invitation-email hex color.**

  Open `src/lib/auth/server.ts`. Find:
  ```html
  background: #0F172A;
  ```

  Replace with:
  ```html
  background: __BRAND_COLOR__;
  ```

  **Why this is safe in TypeScript:** the value lives inside a backtick-template-string and is sent to the browser as inline CSS. At Stage 2-rest, the rendered email would have `background: __BRAND_COLOR__;` which CSS treats as an invalid value and falls back to default — visually fine for typecheck/build (we don't actually send emails from a sentinelized template). Stage 3 substitutes the real hex before any user runs the app.

- [ ] **Step 6: Verify.**

  ```bash
  pnpm typecheck
  pnpm build
  ```

  **Skip `pnpm test` for this step** — vitest reads `wrangler.jsonc` via the cloudflare plugin, and the all-zero D1/KV IDs will cause miniflare to either reject them or create fresh anonymous resources for testing. Test on its own merit:
  ```bash
  pnpm test
  ```
  If it passes, miniflare is being lenient (likely; it doesn't validate IDs against real Cloudflare). If it fails, document the failure mode in the recipe doc and revert *only* the wrangler.jsonc ID sentinels (keep the `name` sentinel) — Stage 3 will substitute IDs early enough that tests run against real-shaped values.

- [ ] **Step 7: Re-grep to confirm no literals remain.**

  ```bash
  grep -rn "quickstart-reference\|Quickstart Reference\|0F172A" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.jsonc" --include="*.css" .
  ```

  Expected: only matches inside `STAGE2_NOTES.md`, the recipe doc, and the plan itself. Code/config files should be clean.

  Also check the resource IDs are gone:
  ```bash
  grep -rn "a5f78b53\|5c21b215" --include="*.jsonc" --include="*.json" .
  ```
  Expected: no matches.

- [ ] **Step 8: Commit.**

  ```bash
  git add package.json wrangler.jsonc src/routes/dashboard/route.tsx src/lib/auth/server.ts
  git commit -m "Stage 2 Task 12: sentinelize literals (__PROJECT_*__) and zero-out D1/KV IDs"
  ```

---

## Task 13: Add bootstrap files (install.sh, install.md, marker, README)

**Files:**
- Create: `install.sh`
- Create: `install.md`
- Create: `.quickstart-template`
- Modify: `README.md` (rewrite as user-facing template overview)

- [ ] **Step 1: Create `.quickstart-template` marker.**

  ```bash
  cd /Users/jamescary/dev/quickstart-template
  cat > .quickstart-template <<'EOF'
  This file marks the directory as an unconfigured quickstart-template clone.
  The setup skill (.claude/skills/quickstart-setup) checks for this file to know
  it should run the interview. The skill deletes this file in its final commit.

  Do not edit or commit changes to this file.
  EOF
  ```

- [ ] **Step 2: Create `install.sh`.**

  Create `/Users/jamescary/dev/quickstart-template/install.sh` with:

  ```bash
  #!/usr/bin/env bash
  # Quickstart-template bootstrapper. Curl-pipeable.
  # Usage:
  #   curl -fsSL https://raw.githubusercontent.com/<USER>/quickstart-template/main/install.sh | bash -s -- my-app
  set -euo pipefail

  TEMPLATE_REPO="https://github.com/__GH_USER__/quickstart-template.git"   # Stage 3 fills __GH_USER__ at publish time
  TARGET="${1:-}"

  if [[ -z "$TARGET" ]]; then
    echo "Usage: install.sh <project-directory>" >&2
    exit 1
  fi

  if [[ -e "$TARGET" ]]; then
    echo "Error: '$TARGET' already exists. Choose a different directory." >&2
    exit 1
  fi

  for tool in git pnpm; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      echo "Error: '$tool' is required but not found. Install it and retry." >&2
      exit 1
    fi
  done

  echo "Cloning template into $TARGET..."
  git clone --depth=1 "$TEMPLATE_REPO" "$TARGET"
  cd "$TARGET"

  echo "Installing dependencies..."
  pnpm install

  echo "Re-initializing git..."
  rm -rf .git
  git init -q
  git add -A
  git commit -q -m "chore: initial commit from quickstart-template"

  cat <<'NEXT'

  ✅ Template ready in $(pwd).

  Next: open this directory in Claude Code, Codex, or Cursor and say:

      run quickstart-setup

  The setup skill will interview you, provision Cloudflare resources,
  customize the template to your project, and clean up after itself.

  NEXT
  ```

  Make it executable:
  ```bash
  chmod +x install.sh
  ```

  **Note on `__GH_USER__`:** this is a Stage 3 publishing concern, not a user-facing sentinel. The skill itself doesn't run `install.sh` — users do. When the template is first published to GitHub (Stage 3 deferrable), the user replaces `__GH_USER__` with their actual GitHub username/org. Document this in `install.md` (next step).

- [ ] **Step 3: Create `install.md` (agent-readable equivalent of `install.sh`).**

  Create `/Users/jamescary/dev/quickstart-template/install.md`:

  ```markdown
  # Installing quickstart-template (agent-readable)

  This file is the agent-driven mirror of `install.sh`. If a user pastes "Read this and follow it" with a link to this file, the agent should execute the steps below in their working directory.

  ## Inputs

  - `<TARGET>`: the directory name for the new project (kebab-case, e.g., `my-app`).

  ## Pre-flight checks

  Before any action, verify these tools are available; abort with a clear error if any are missing:

  ```bash
  git --version
  pnpm --version
  node --version    # require >= 20
  ```

  ## Steps

  1. **Verify the target does not exist.** If `<TARGET>` already exists as a file or directory, stop and report: "`<TARGET>` already exists; choose a different name."

  2. **Clone the template.**
     ```bash
     git clone --depth=1 https://github.com/__GH_USER__/quickstart-template.git <TARGET>
     ```
     (`__GH_USER__` is the GitHub user/org hosting the template — replace with the actual value before running.)

  3. **Enter the cloned directory.**
     ```bash
     cd <TARGET>
     ```

  4. **Install dependencies.**
     ```bash
     pnpm install
     ```

  5. **Re-initialize git.** The template's history is not the user's history.
     ```bash
     rm -rf .git
     git init
     git add -A
     git commit -m "chore: initial commit from quickstart-template"
     ```

  6. **Tell the user what to do next.** Print:
     > Template ready. Open this directory in Claude Code, Codex, or Cursor and say "run quickstart-setup". The setup skill will interview you, provision Cloudflare resources, customize the template, and clean up after itself.

  ## What the agent should NOT do at this step

  - Do **not** run the `quickstart-setup` skill yet — `install.md` is the *bootstrap*; the skill runs in a fresh session after the user opens the cloned directory.
  - Do **not** modify `.quickstart-template` (the marker file the skill uses for entry detection).
  - Do **not** delete the `.claude/skills/quickstart-setup/` directory — the skill self-removes at its own completion (Stage 3 behavior).

  ## Troubleshooting

  - `git clone` fails with "Could not resolve host": GitHub may be unreachable; retry with VPN off.
  - `pnpm install` fails on a missing platform binary (esbuild/lightningcss): re-run `pnpm install`; the `pnpm.onlyBuiltDependencies` whitelist ensures these can rebuild.
  - User forgot to install pnpm: run `corepack enable pnpm` and retry.
  ```

- [ ] **Step 4: Rewrite `README.md` as the user-facing template README.**

  Replace `/Users/jamescary/dev/quickstart-template/README.md` (currently the reference's README) with:

  ```markdown
  # __PROJECT_NAME__

  __PROJECT_DESCRIPTION__

  Built from [quickstart-template](https://github.com/__GH_USER__/quickstart-template) — a Cloudflare-native full-stack starter using TanStack Start, Drizzle, D1, KV, Durable Objects, better-auth, and Resend.

  ## Quickstart

  This project was scaffolded by the `quickstart-setup` skill. Cloudflare resources, OAuth credentials, and an example feature have already been wired up. To start developing:

  ```bash
  pnpm install
  cp .dev.vars.example .dev.vars   # then fill in BETTER_AUTH_SECRET (openssl rand -base64 32) and any OAuth/Resend keys
  pnpm db:migrate:local             # apply Drizzle migrations to local D1
  pnpm dev                          # http://localhost:3000
  ```

  ## Stack

  - **Frontend + server:** TanStack Start (React, file-based routing, server functions)
  - **Hosting:** Cloudflare Workers via `@cloudflare/vite-plugin`
  - **Database:** Cloudflare D1 + Drizzle ORM
  - **KV:** Cloudflare Workers KV (used by better-auth for rate limiting + cache)
  - **Realtime:** Cloudflare Durable Objects (presence widget — included if you opted in)
  - **Auth:** better-auth + `better-auth-cloudflare`
  - **Email:** Resend (with dev-mode console fallback) — included if you opted in
  - **UI:** Tailwind v4 + shadcn/ui (`new-york`)
  - **Tests:** Vitest + `@cloudflare/vitest-pool-workers` — included if you opted in
  - **Package manager:** pnpm

  ## Test

  ```bash
  pnpm test
  ```

  Tests run against the real Cloudflare runtime via miniflare (D1, KV, Durable Objects all bind in tests).

  ## Deploy

  ```bash
  wrangler login                    # one-time
  ./scripts/deploy-secrets.sh       # pushes .dev.vars values as production secrets (one-time)
  pnpm db:migrate:remote            # push schema to production D1
  pnpm build
  wrangler deploy
  ```

  ## Background

  This project is built from a template that ships every supported feature wired up; the setup skill subtracted features you opted out of and scaffolded a starter feature based on your description.

  See [the template repo](https://github.com/__GH_USER__/quickstart-template) for source and updates.
  ```

  **Note on `scripts/deploy-secrets.sh`:** the design spec mentions this helper. Stage 3's skill writes it during the Apply phase. **Stage 2 does not create this file** — at template-at-rest there's no `.dev.vars` to read from. Just leave the README reference; users see a real script after running the skill.

- [ ] **Step 5: Verify.**

  ```bash
  pnpm typecheck && pnpm build
  ```

  Expected: still passes. None of these new files affect TypeScript.

- [ ] **Step 6: Commit.**

  ```bash
  git add install.sh install.md .quickstart-template README.md
  git commit -m "Stage 2 Task 13: add bootstrap files (install.sh, install.md, marker, user-facing README)"
  ```

---

## Task 14: Update `STATUS.md` and finalize Stage 2

- [ ] **Step 1: Update `STATUS.md` to mark Stage 2 done.**

  Open `/Users/jamescary/dev/quickstart-template/STATUS.md`. Update the table row for Stage 2:

  Find:
  ```markdown
  | **Stage 2 — templatize** | ⏳ Pending | Will copy `reference/` → repo root, wrap conditional regions with `// #region quickstart:if=X` markers per the BUILD_NOTES Files Inventory, replace literals with `__PROJECT_NAME__` sentinels, manually validate subtraction. Plan to be written. |
  ```

  Replace with:
  ```markdown
  | **Stage 2 — templatize** | ✅ Done (YYYY-MM-DD) | Reference copied to repo root with region markers + sentinels. Subtraction validated by hand for all 5 toggles. Subtraction recipes captured at `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`. Plan: `docs/superpowers/plans/2026-05-01-stage2-templatize.md`. Bootstrap files (`install.sh`, `install.md`, `.quickstart-template`, user-facing `README.md`) added. Template at-rest typechecks + builds; does not run until the skill substitutes sentinels and provisions IDs. |
  ```

  Replace `YYYY-MM-DD` with today's date.

- [ ] **Step 2: Update the "Where things live" section.**

  Replace the existing tree block in `STATUS.md` with:
  ```markdown
  /Users/jamescary/dev/quickstart-template/
  ├── STATUS.md                                    # this file
  ├── README.md                                    # user-facing template README (sentinelized)
  ├── install.sh                                   # curl-pipeable bootstrapper
  ├── install.md                                   # agent-readable bootstrap
  ├── .quickstart-template                         # marker for skill entry detection
  ├── package.json, wrangler.jsonc, ...            # full template (sentinelized)
  ├── src/, tests/, drizzle/                       # template source (region-marked)
  ├── docs/superpowers/
  │   ├── specs/2026-04-30-quickstart-template-design.md
  │   ├── specs/2026-05-01-stage2-subtraction-recipes.md   # Stage 2 output: per-toggle subtraction recipes (Stage 3 input)
  │   ├── plans/2026-04-30-stage1-reference-app.md   # Stage 1 plan, complete
  │   └── plans/2026-05-01-stage2-templatize.md      # Stage 2 plan, complete
  └── reference/                                   # Stage 1 output (NESTED git repo, gitignored)
      ├── BUILD_NOTES.md                           # 1145 lines: per-task log + Files Inventory
      └── ... (full working app)
  ```

- [ ] **Step 3: Update the "To pick up where we left off" section.**

  Replace:
  ```markdown
  4. Decide what to do next — most likely **write the Stage 2 plan** using the `superpowers:writing-plans` skill, with `BUILD_NOTES.md`'s Files Inventory as the primary input. Save the resulting plan to `docs/superpowers/plans/YYYY-MM-DD-stage2-templatize.md`.
  ```
  with:
  ```markdown
  4. Decide what to do next — most likely **write the Stage 3 plan** using the `superpowers:writing-plans` skill, with `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md` as the primary input for `manifest.json` and `reference/BUILD_NOTES.md` as the source for cloudflare/credentials/scaffold-feature instructions. Save the resulting plan to `docs/superpowers/plans/YYYY-MM-DD-stage3-build-skill.md`.
  ```

- [ ] **Step 4: Add a Stage 2 known-limitations + patterns section.**

  Append to `STATUS.md` (after the existing Stage 1 patterns section):

  ```markdown
  ## Stage 2 known limitations / things deferred to Stage 3

  - **Sentinelized template doesn't run as-is.** `__PROJECT_SLUG__` is not a valid wrangler worker name and the all-zero D1/KV IDs will fail miniflare/wrangler. Stage 3's skill must substitute sentinels and provision real IDs *before* `pnpm dev` works for the user.
  - **Schema regen is Stage 3's job.** Stage 2 leaves `src/db/auth-schema.ts` with all tables (incl. org tables) regardless of toggles. Stage 3 runs `pnpm exec @better-auth/cli generate` to regenerate the file with only the chosen plugins' tables.
  - **`worker-configuration.d.ts` is stale-by-design.** Stage 3 must run `pnpm exec wrangler types` after stripping `wrangler.jsonc` regions and writing real IDs.
  - **Both-OAuth-providers-off cleanup is combinatorial, not in regions.** When neither GitHub nor Google is selected, the `OAuthButtons` component renders an empty div. Stage 3's skill must detect the both-off case and additionally delete `oauth-buttons.tsx` + strip imports/JSX from `login.tsx` and `signup.tsx`.
  - **`scripts/deploy-secrets.sh` is not in the template.** Stage 3 generates it during the Apply phase from the user's chosen `.dev.vars` keys.
  - **`__GH_USER__` placeholder in `install.sh` and `install.md`.** Stage 3 (or template publishing step) must replace this with the actual GitHub user/org hosting the template repo.

  ## Stage 2 patterns Stage 3 should preserve verbatim

  1. **Region marker syntax** has 4 variants by file type — see `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md` "Marker convention" section.
  2. **Stripping a region removes the marker lines themselves** along with the body. Plain non-`#region` comments are unaffected.
  3. **Sentinels:** exactly `__PROJECT_NAME__`, `__PROJECT_SLUG__`, `__PROJECT_DESCRIPTION__`, `__BRAND_COLOR__`. No others. Don't invent new ones in Stage 3 — extend this list explicitly if needed.
  4. **D1/KV IDs use all-zeros placeholders, not sentinels.** The skill overwrites by binding name (`DB`, `KV`), not by detecting placeholder text.
  5. **Tests directory is whole-file deletion when `vitest` off; `tests/worker-entry.ts` is a `replace` op when `do` off.** See recipe doc Task 10.
  ```

- [ ] **Step 5: Delete the Stage 2 working notes file.**

  ```bash
  rm STAGE2_NOTES.md
  ```

  (This file was used during the Stage 2 build for scratch notes. By Task 14 the relevant content has been migrated to the recipe doc and STATUS.md.)

- [ ] **Step 6: Final verification.**

  ```bash
  cd /Users/jamescary/dev/quickstart-template
  pnpm typecheck
  pnpm build
  ```

  Both must pass. (`pnpm test` is **not** verified at this point because the wrangler.jsonc IDs are all-zero; documented as expected behavior.)

- [ ] **Step 7: Commit and mark Stage 2 complete.**

  ```bash
  git add STATUS.md .gitignore
  git commit -m "Stage 2 complete: templatize done, recipes captured, STATUS updated"
  git log --oneline | head -20
  ```

  Expected: ~14 commits, one per task, all on `main`.

---

## Self-Review (run after writing the plan)

- **Spec coverage.** Spec Stage 2 (line 220 onward of `docs/superpowers/specs/2026-04-30-quickstart-template-design.md`) lists 5 things:
  1. Rename literals to placeholder sentinels — Task 12 ✅
  2. Wrap conditional regions with `// #region quickstart:if=X` markers — Tasks 2–6 ✅
  3. Add `.quickstart-template` marker, `install.sh`, `install.md`, `README.md` — Task 13 ✅
  4. Verify the template still runs with all features on — Tasks 1, 2, 3, 4, 5, 6 verify steps ✅
  5. Test subtraction by hand — Tasks 7–11 ✅

  All five spec items map to tasks.

- **Placeholder scan.** No `TBD`, `TODO`, `implement later`, `add appropriate error handling` etc. — every step has concrete code/commands. JSON-AST edits in `package.json` are spelled out by key. Region locations are pinpointed by file + tag + count.

- **Type consistency.** Sentinel names are stable across tasks (always `__PROJECT_SLUG__`, never `__PROJECT__SLUG__` or similar). Toggle names match: `resend`, `org`, `oauth.github`, `oauth.google`, `do`, `vitest`. Recipe doc filename `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md` is referenced consistently in Tasks 7, 8, 9, 10, 11, 14.

- **Order correctness.** Tasks 1–6 keep literal names so dev/build/test all work as gates. Tasks 7–11 do subtraction validation with literals (easier to verify). Task 12 sentinelizes (build still passes; dev/test now require Stage 3 substitution). Task 13 adds bootstrap files. Task 14 finalizes. This is the only order that lets us validate at every stage.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-01-stage2-templatize.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task; review between tasks. Good for this plan because each task has a clear verification gate (typecheck/build/test) the reviewer can re-run.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
