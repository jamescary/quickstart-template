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

**Validated:** 2026-05-01 against template at commit `a464f6c` (post-marker-revision).

**Whole-file deletions:**
- `src/server/email.ts`

**Region strips (file → tag):**
- `src/lib/auth/server.ts`: `resend` (3 regions: import, AuthEnv keys, full `afterCreateInvitation` property inside `organizationHooks`)
- `.dev.vars.example`: `resend` (1 region)

**JSON edits:**
- `package.json` `dependencies`: remove key `resend`.

**Verification (post-subtraction):** `pnpm install && pnpm typecheck && pnpm build && pnpm test` — all pass with 6 tests passing (auth: 2, kv: 2, presence: 2).

**Notes:**
- The plan originally specified wrapping only the *body* of `afterCreateInvitation` in the `resend` region. That left an empty arrow function with destructured params, which fails `noUnusedParameters: true` (TS6198). The revised marker placement (committed in `a464f6c`) wraps the **entire property** so the strip removes the whole hook entry; better-auth treats a missing hook as a no-op, which is the desired behavior.
- The `createEmailer` import is wrapped in **nested** regions (outer `org`, inner `resend`). Either toggle off strips it. See Task 8 notes for why this is required.

---

## Toggle: `org`

**Validated:** 2026-05-01 against template at commit `41082dd`.

**Whole-file/dir deletions:**
- `src/routes/dashboard/org/` (entire directory: `index.tsx`, `invite.tsx`)
- `src/components/org-switcher.tsx`

**Region strips (file → tag):**
- `src/lib/auth/server.ts`: `org` (3 regions: `organization` import, full `organization({...})` plugin entry, plus the *outer* `org` region wrapping the nested `org→resend` `createEmailer` import)
- `src/lib/auth/client.ts`: `org` (2 regions: `organizationClient` import, plugin entry)
- `src/routes/dashboard/route.tsx`: `org` (2 regions: `OrgSwitcher` import, JSX mount — JSX variant `{/* #region */}`)
- `tests/auth.test.ts`: `org` (1 region: `organizations`/`members`/`invitations` table-name array entries)

**JSON edits:** none. (The `better-auth/plugins` import path stays available via the package — `@better-auth/drizzle-adapter` is still needed for the base auth tables.)

**Schema regen (Stage 3 only):** the org tables persist in `src/db/auth-schema.ts` after Stage 2 subtraction. Stage 3's skill regenerates this file via `pnpm exec @better-auth/cli generate` *after* stripping the `organization()` plugin from `auth.ts`. The CLI emits only the plugins still present in `createAuth`. **For Stage 2 validation purposes, leaving the org tables in `auth-schema.ts` is acceptable** — they compile fine (no runtime references after subtraction) and tests still query them (and they exist in the test D1 because migrations include them). Tests' `organizations`/`members`/`invitations` table assertions are stripped by the `org` region in `auth.test.ts`, so the test suite no longer attempts to query them.

**Verification (post-subtraction):** `pnpm typecheck && pnpm build && pnpm test` all pass with 6 tests passing (auth: 2, kv: 2, presence: 2).

**Notes:**
- Stripping `org` outer regions transitively removes any nested `resend` regions (e.g., the `createEmailer` import). This is the documented "outer-first" stripping behavior.
- The plan also says "wrap the entire `organization({...})` call but **not** the surrounding `plugins: []` declaration — the array stays even if empty." That's preserved here; better-auth accepts `plugins: []`.

---

## Toggle: `oauth.github` (validated)

**Validated:** 2026-05-01 against template at commit `a575443`.

**Whole-file deletions:** none.

**Region strips (file → tag):**
- `src/lib/auth/server.ts`: `oauth.github` (2 regions: AuthEnv keys, `social.github` block)
- `src/components/auth/oauth-buttons.tsx`: `oauth.github` (1 region: button JSX)
- `.dev.vars.example`: `oauth.github` (1 region: env keys)

**JSON edits:** none.

**Verification:** `pnpm typecheck && pnpm build && pnpm test` pass with 6 tests.

---

## Toggle: `oauth.google` (mirror — not separately validated)

Symmetric to `oauth.github`:

**Region strips (file → tag):**
- `src/lib/auth/server.ts`: `oauth.google` (2 regions: AuthEnv keys, `social.google` block)
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

---

## Toggle: `do`

**Validated:** 2026-05-01 against template at commit `0c122d3`.

**Whole-file deletions:**
- `src/server/presence-do.ts`
- `src/components/presence-widget.tsx`
- `src/routes/api/presence/$.ts` (and the empty `src/routes/api/presence/` directory)
- `tests/presence.test.ts`

**File replacements (skill rewrites):**
- `tests/worker-entry.ts`: rewrite to a minimal stub (drop the `export { PresenceDO }` line; keep the default `fetch`-only export). Stage 3's manifest entry should be a `replace` op, not a delete — vitest.config.ts's `cloudflareTest({ main: "./tests/worker-entry.ts" })` still references this path.

**Region strips (file → tag):**
- `src/server.ts`: `do` (1 region: PresenceDO re-export)
- `src/routes/dashboard/index.tsx`: `do` (2 regions: import, JSX mount — JSX variant `{/* #region */}`)
- `wrangler.jsonc`: `do` (1 region: `durable_objects` + `migrations` blocks)

**JSON edits:** none. (DO config is in `wrangler.jsonc` which uses `// #region` comments — JSONC supports them.)

**Worker type regeneration required:** Stage 3 must run `pnpm exec wrangler types` after stripping `wrangler.jsonc` regions, otherwise `worker-configuration.d.ts` retains stale `PRESENCE` binding type. (For Stage 2 validation, the binding's absence in the live wrangler.jsonc was sufficient — tests pass without regenerating the types file because the existing types file declares `PRESENCE` but no test references it after `tests/presence.test.ts` is deleted.)

**Verification:** `pnpm typecheck && pnpm build && pnpm test` pass with 4 tests (auth: 2, kv: 2).
