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
