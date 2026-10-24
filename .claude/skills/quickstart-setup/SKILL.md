---
name: quickstart-setup
description: Use this skill ONCE per project, immediately after cloning the quickstart-template, to interview the user, provision Cloudflare resources, customize the template, scaffold a starter feature, and self-remove. Triggers on the user saying "run quickstart-setup", "set up the quickstart", or any equivalent. Detects entry via the `.quickstart-template` marker file at the working directory root; aborts if the marker is missing.
---

# quickstart-setup

You are setting up a freshly cloned `quickstart-template` project for the user. This skill is **one-shot**: it runs once, mutates the project, and removes itself. There is no resume mode — if it crashes, the user inspects the per-phase commits and recovers manually.

## Entry detection (run first, before anything else)

1. From the project root, check for the marker file:
   ```bash
   test -f .quickstart-template && echo "MARKER_PRESENT" || echo "MARKER_ABSENT"
   ```

2. **`MARKER_PRESENT`** ⇒ proceed to Phase 1.

3. **`MARKER_ABSENT`** ⇒ check whether the directory is empty:
   ```bash
   ls -A | grep -v '^\.git$' | head -1
   ```
   - **No output** (only `.git/` or fully empty) ⇒ global-install mode. Read `TEMPLATE_URL` (a plain-text file in this skill directory), then run:
     ```bash
     pnpm dlx degit "<contents-of-TEMPLATE_URL>" .
     pnpm install
     ```
     Re-check the marker. If still absent, abort with: "Template clone did not produce the marker file. Is the URL correct?"
   - **Has output** (any non-`.git` content) ⇒ abort with: *"This directory contains files that aren't from `quickstart-template` (no `.quickstart-template` marker). Either run this in an empty directory (the skill will clone for you), or run `install.sh` first to clone the template."*

## Phase 1 — Identity

Read `interview.md` and follow Phase 1 questions. Capture answers in your working notes.

## Phase 2 — Feature toggles

Read `interview.md` § Phase 2. Capture toggle answers (booleans) and the OAuth provider multi-select.

## Phase 3 — First-feature description

Read `interview.md` § Phase 3. Capture a 1–2 sentence description.

## Phase 4 — Cloudflare provisioning

Read `cloudflare.md`. Run the wrangler commands described there. **No questions to user except picking an account if `wrangler whoami` lists multiple.**

## Phase 5 — Credentials

Read `credentials.md`. Walk the user through each chosen provider's console; collect client ID + secret per provider; collect Resend key if `resend` is on. Write to `.dev.vars`.

## Phase 6 — Final confirmation

Read `interview.md` § Phase 6. Print the summary; require explicit "yes" before Phase 7.

## Subtraction algorithm (used in Apply Step 1)

For each toggle in `manifest.json["toggles"]` whose user-chosen value is **false**, do these ops in this order:

### 1. `delete`

For each path:
- If it's a file, `rm -f <path>`.
- If it's a directory, `rmdir <path>` (only succeeds if already empty after the file deletes — manifest `delete` order lists files first, then their parent dir, by design).

### 2. `strip`

For each `{ file, tag }` entry:
1. `Read` the file.
2. Detect file kind by extension and choose the matching marker pair (see "Region-marker grep patterns" in the plan / SKILL.md conventions).
3. Walk the file line-by-line, tracking nesting depth. When you encounter `// #region quickstart:if=<tag>` (or its variant), record the opening line number and increment depth. When you encounter `// #endregion`, decrement depth — if depth returns to zero **and** the matching open was for THIS tag, mark the closed line. After the walk, delete every line in any "this-tag" open/close pair, plus all lines between (inclusive of the markers themselves).
4. Note: a file may have BOTH `org` and `resend` regions (e.g., `src/lib/auth/server.ts`). Process toggles independently; nested-but-different-tag regions strip outer-first if the outer toggle is off, otherwise the inner is processed in its own pass.
5. Write the file back.

**JSX positional regions** use `{/* #region */}` markers; a file may contain BOTH plain-`//` regions (in TS code) AND JSX regions (inside the JSX return) — both are processed in the same pass.

### 3. `edit_json`

`package.json` is plain JSON (no comments). Parse with `JSON.parse`, mutate, write back with 2-space indentation:

```bash
pnpm exec node -e '
  const fs = require("node:fs");
  const file = process.argv[1];
  const segs = JSON.parse(process.argv[2]);  // e.g., ["dependencies","resend"]
  const obj = JSON.parse(fs.readFileSync(file, "utf8"));
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) cur = cur[segs[i]];
  delete cur[segs[segs.length - 1]];
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
' <FILE> '["<seg1>","<seg2>"]'
```

`wrangler.jsonc` and `tsconfig.json` contain comments. The manifest does NOT use `edit_json` for these (their ops are `strip` operations against region markers, which the line-based strip algorithm handles directly). The only post-Stage-2 mutations to `wrangler.jsonc` are the resource-ID overwrites in Phase 4 — those use `sed` against the unique zero-placeholder values (see `cloudflare.md`).

### 4. `replace_file`

Overwrite the file with the supplied `content` string verbatim.

### 5. Combinatorial post-pass

After all per-toggle ops complete, evaluate `manifest.json["post_subtraction_combinatorial"]` entries. Each has a `condition` expressed as a JS-style boolean over `toggles`; evaluate it and, if true, run its `delete` and `regex_strip` ops. `regex_strip` removes whole lines matching any regex pattern in the list (line-anchored).

### 6. Verification

After all ops:
```bash
pnpm install     # rebuild lockfile after dep removals
pnpm exec tsc --noEmit
```
If `tsc` fails, the most likely cause is a missed reference. Surface the error verbatim to the user, then halt — do not attempt automated recovery. The phase-by-phase commit boundary means the user can `git revert` to restart.

## Phase 7 — Apply

Run the Apply phase steps below. **Commit after each step** so a crash is recoverable.

The Apply phase mutates source files. **Commit after each numbered step** so a crash leaves a recoverable state.

### Apply Step 1 — Subtract opted-out features

Run the manifest-driven subtraction (see "Subtraction algorithm" earlier in this file).

For each toggle whose value is **false**:
- Run all `delete` ops.
- Run all `strip` ops.
- Run all `edit_json` ops.
- Run all `replace_file` ops (only `do` has these — the `tests/worker-entry.ts` rewrite).

After all per-toggle ops, evaluate `manifest.json["post_subtraction_combinatorial"]`. Currently only `no_oauth_providers` exists; if it triggers, run its `delete` + `regex_strip` ops.

Verify:
```bash
pnpm install
pnpm exec tsc --noEmit
```

If `tsc` fails, surface the full output to the user and halt — do not attempt automated recovery. The most likely cause is a stripped region that left a dangling reference; check `git diff` for the file in the error.

Commit:
```bash
git add -A
git commit -m "chore(quickstart-setup): subtract opted-out features"
```

### Apply Step 2 — Substitute sentinels

Replace the four sentinels globally. Use `find` + `sed` (BSD sed on macOS requires `-i ''`):

```bash
# Define replacements (use the user's captured values; no shell expansion of values)
PROJECT_NAME='<value from Q1>'
PROJECT_SLUG='<value from Q2>'
PROJECT_DESCRIPTION='<value from Q3>'
BRAND_COLOR='<value from Q4>'

# Files to scan: every text file under the project tree, excluding .git, node_modules, dist, .wrangler
find . -type f \
  ! -path './.git/*' \
  ! -path './node_modules/*' \
  ! -path './dist/*' \
  ! -path './.wrangler/*' \
  -exec grep -lE '__PROJECT_(NAME|SLUG|DESCRIPTION)__|__BRAND_COLOR__' {} + \
| while read -r f; do
    # Use a sed delimiter that won't appear in any value (pipe).
    sed -i '' \
      -e "s|__PROJECT_NAME__|${PROJECT_NAME//|/\\|}|g" \
      -e "s|__PROJECT_SLUG__|${PROJECT_SLUG}|g" \
      -e "s|__PROJECT_DESCRIPTION__|${PROJECT_DESCRIPTION//|/\\|}|g" \
      -e "s|__BRAND_COLOR__|${BRAND_COLOR}|g" \
      "$f"
  done
```

Caveats:
- `PROJECT_DESCRIPTION` may contain quotes. The skill must JSON-escape it for `package.json` BEFORE running sed. Easier: write `package.json` separately via a JSON write, AFTER running the global sed (it will idempotently re-replace from a substituted value to the same substituted value — no-op).
- If sed-on-macOS produces backup files (`-i ''` should not, but verify), clean them up: `find . -name '*-e' -path '*/__sed__*' -delete`.

Verify no sentinels remain:
```bash
! grep -rEn '__PROJECT_(NAME|SLUG|DESCRIPTION)__|__BRAND_COLOR__' . \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.wrangler
```

Expected: no output (the leading `!` makes `0 matches` exit 0).

Commit:
```bash
git add -A
git commit -m "chore(quickstart-setup): substitute project sentinels"
```

### Apply Step 3 — Apply brand color to shadcn `--primary`

The `__BRAND_COLOR__` substitution above already replaced the sentinel in `src/lib/auth/server.ts` (the invitation-email button). The shadcn theme in `src/styles.css` uses HSL-space tokens (`222.2 47.4% 11.2%`), not hex — a separate hex→HSL conversion patches `--primary` (and `--primary-foreground` flips for contrast).

Convert the user's `BRAND_COLOR` (hex) to HSL:

```bash
pnpm exec node --input-type=module -e '
const hex = process.argv[1].replace(/^#/, "");
const r = parseInt(hex.slice(0,2), 16) / 255;
const g = parseInt(hex.slice(2,4), 16) / 255;
const b = parseInt(hex.slice(4,6), 16) / 255;
const max = Math.max(r,g,b), min = Math.min(r,g,b);
const l = (max+min)/2;
let h = 0, s = 0;
if (max !== min) {
  const d = max - min;
  s = l > 0.5 ? d/(2-max-min) : d/(max+min);
  switch(max){
    case r: h = (g-b)/d + (g<b ? 6:0); break;
    case g: h = (b-r)/d + 2; break;
    case b: h = (r-g)/d + 4; break;
  }
  h /= 6;
}
const H = (h*360).toFixed(1);
const S = (s*100).toFixed(1);
const L = (l*100).toFixed(1);
const fg = l > 0.5 ? "0 0% 9%" : "0 0% 98%";
console.log(`${H} ${S}% ${L}%|${fg}`);
' '<BRAND_COLOR>'
```

Output is two HSL strings separated by `|`: e.g., `222.2 47.4% 11.2%|0 0% 98%`.

Patch `src/styles.css`:

```bash
PRIMARY_HSL='<the first part>'
PRIMARY_FG_HSL='<the second part>'
sed -i '' \
  -e "s/--primary: 222\.2 47\.4% 11\.2%;/--primary: ${PRIMARY_HSL};/" \
  -e "s/--primary-foreground: 210 40% 98%;/--primary-foreground: ${PRIMARY_FG_HSL};/" \
  src/styles.css
```

(The dark-block `--primary: 210 40% 98%;` line stays as-is — dark-mode primary uses the contrast color, not the brand color directly. If you want the dark-mode primary to be the brand color too, that's a hand-edit the user does after the skill finishes.)

Commit:
```bash
git add -A
git commit -m "chore(quickstart-setup): apply brand color to shadcn theme"
```

### Apply Step 4 — Regenerate auth schema

After subtracting `org` (or any other auth-plugin-affecting toggle), the auth-schema file may contain tables that no longer have a corresponding plugin in `auth.ts`. Regenerate from scratch:

```bash
pnpm exec @better-auth/cli@1.4.22 generate \
  --config src/lib/auth/server.ts \
  --output src/db/auth-schema.ts \
  --yes
```

Expected: the CLI emits a "Base URL could not be determined" warning (expected — no env in CLI mode) and writes `src/db/auth-schema.ts` with only the tables corresponding to enabled plugins. If `org` is off, the `organizations` / `members` / `invitations` tables are absent from the regenerated file.

Commit:
```bash
git add src/db/auth-schema.ts
git commit -m "chore(quickstart-setup): regenerate auth-schema for selected plugins"
```

### Apply Step 5 — Drop reference migrations + regenerate

The reference's two migration files (`0000_slippery_millenium_guard.sql` for `notes` and `0001_wild_talos.sql` for auth) reflect Stage 1's schema. After auth-schema regen (Step 4) and the upcoming feature scaffold (Step 6), the schema is different. Drop and regenerate:

```bash
rm -f drizzle/migrations/*.sql
rm -rf drizzle/migrations/meta
```

Note: Step 6 happens BEFORE the regen here. Why? Because the new feature's table belongs in the same first migration as auth-schema. Sequencing:

1. Step 4: regen `auth-schema.ts` (already done above).
2. Step 6: scaffold first feature (replaces `notes` in `schema.ts` with `<feature_plural>`).
3. **Then come back here** and run `pnpm db:generate` so the migration covers everything currently in `schema.ts` + `auth-schema.ts`.

So this Step 5 has two halves separated by Step 6:

**5a. Drop reference migrations** (do now):
```bash
rm -f drizzle/migrations/*.sql
rm -rf drizzle/migrations/meta
```

**5b. Generate fresh migration** (do AFTER Step 6):
```bash
pnpm db:generate
```

Verify the new migration:
```bash
ls drizzle/migrations/
```
Expected: one `.sql` file (the freshly generated `0000_<random_name>.sql`).

Apply locally to validate the SQL:
```bash
wrangler d1 migrations apply <PROJECT_SLUG>-db --local
```
Expected: "✅" — N commands executed successfully.

Commit (combined with Step 6):
```bash
git add -A
git commit -m "chore(quickstart-setup): scaffold first feature + regenerate migrations"
```

### Apply Step 6 — Scaffold first feature

Read `scaffold-feature.md` and follow its 6 steps. The output is four new (or replaced) files plus a dashboard nav link edit.

After scaffolding, return to Apply Step 5b to generate the migration that covers the new schema.

### Apply Step 7 — Regenerate worker types + write deploy-secrets.sh + write project README + final verification

Now that `wrangler.jsonc` is fully valid (real D1 ID, real KV ID, real worker name from sentinel substitution, `do` regions stripped if applicable), regenerate the typed `Env`:

```bash
pnpm exec wrangler types
```

Expected: `worker-configuration.d.ts` is rewritten. If `toggles.do == false`, the `PRESENCE: DurableObjectNamespace<...>` field is absent.

Write the deploy-secrets helper (template at `credentials.md` "Production secrets — generated"):

```bash
mkdir -p scripts
cat > scripts/deploy-secrets.sh <<'EOF'
<the contents from credentials.md verbatim>
EOF
chmod +x scripts/deploy-secrets.sh
```

**Overwrite `README.md` with a project-focused version.** The on-disk template `README.md` describes the `quickstart-template` repo itself — it's not the right thing to ship in a scaffolded project. Replace it with a project README using the captured identity values:

```bash
cat > README.md <<EOF
# <PROJECT_NAME>

<PROJECT_DESCRIPTION>

Scaffolded from [quickstart-template](https://github.com/jamescary/quickstart-template).

## Develop

\`\`\`bash
pnpm install
pnpm dev          # http://localhost:3000 (vp dev)
pnpm check        # format + lint + typecheck (vp check)
\`\`\`

## Deploy

\`\`\`bash
wrangler login                    # one-time
./scripts/deploy-secrets.sh       # pushes .dev.vars values as production secrets (one-time)
pnpm db:migrate:remote            # push schema to production D1
pnpm build
wrangler deploy
\`\`\`

After your first deploy, override \`BETTER_AUTH_URL\` with the production URL:

\`\`\`bash
echo 'https://<your-worker>.workers.dev' | wrangler secret put BETTER_AUTH_URL
VITE_BETTER_AUTH_URL='https://<your-worker>.workers.dev' pnpm build && wrangler deploy
\`\`\`

EOF
```

If `toggles.vitest == true`, append a test section:

```bash
cat >> README.md <<'EOF'
## Test

\`\`\`bash
pnpm test
\`\`\`

Tests run with `vp test` (Vitest 5 via Vite+) inside workerd through `@cloudflare/vitest-plugin`, so D1, KV and Durable Objects all bind in tests. `pnpm check` runs format, lint and typecheck in one pass.

EOF
```

(The user can flesh out the README further — keep this minimal.)

Final at-rest verification:

```bash
pnpm install                    # rebuild lockfile (subtract step removed deps; install consolidates)
pnpm exec tsc --noEmit          # full typecheck against the post-substitution tree
pnpm check                      # vp check: format + lint + typecheck against the post-substitution tree
pnpm build                      # vp build — should now succeed because wrangler.jsonc is valid
```

If `vitest` is on:
```bash
pnpm test                       # vp test run — 6 tests pass in workerd (or fewer, if `do`/`org` toggles dropped tests)
```

If any of the above fail, surface the error and halt. Common failure modes:
- `pnpm install` fails with "lockfile mismatch" — re-run `pnpm install --no-frozen-lockfile`.
- `pnpm build` fails with "wrangler.jsonc validation failed: name" — sentinels weren't fully substituted; re-grep and resolve.
- `pnpm test` fails with "TypeError: Cannot read properties of undefined" inside `tests/auth.test.ts` — likely the `org` strip didn't remove the right region; check `tests/auth.test.ts` for stale `organizations` / `invitations` references.

Commit:
```bash
git add -A
git commit -m "chore(quickstart-setup): regenerate types + deploy-secrets.sh + verify build"
```

### Apply Step 8 — Initialize fresh git history (or commit)

The bootstrap (`install.sh` or manual clone) already runs `git init` + an initial commit. Each Apply step has been creating commits on top of that. Step 8 is a no-op IF that bootstrap ran. But if the user ran the skill in an existing repo without bootstrap (e.g., they `git clone`d the template manually instead of using `install.sh`), the `.git` history reflects the template repo, not the user's project. Detect:

```bash
# Detect: is the current HEAD a "chore: initial commit from quickstart-template" commit
# (the bootstrap-flow signature), or is it the template repo's history (multiple commits)?
COMMIT_COUNT=$(git rev-list --count HEAD)
FIRST_MSG=$(git log --reverse --pretty=%s | head -1)
```

- If `COMMIT_COUNT == 1` AND the message starts with `chore: initial commit from quickstart-template` ⇒ bootstrap was used; do nothing.
- Otherwise ⇒ the user is in the template's own history. Re-init:
  ```bash
  rm -rf .git
  git init -q
  git add -A
  git commit -q -m "chore: initial commit from quickstart-template"
  ```
  Then re-apply ALL the per-step commits from this run as squashed work (i.e., the previous Apply step commits are gone — that's fine, they were against the wrong history). Add a single follow-up commit summarizing the setup:
  ```bash
  git commit --allow-empty -m "chore(quickstart-setup): apply customizations"
  ```

(In practice, this re-init path is rare — almost all users come through `install.sh`. Document it but don't optimize for it.)

### Apply Step 9 — GitHub repo + Workers Git Integration (conditional)

Only if `WORKERS_GIT_INTEGRATION == true`:

```bash
gh --version 2>/dev/null
```

- **`gh` not installed or not authenticated** ⇒ print:
  > `gh` CLI is not available. Skipping automatic GitHub repo creation.
  > To set up Workers Git Integration manually:
  >   1. Create a private GitHub repo at https://github.com/new (name: `<PROJECT_SLUG>`)
  >   2. Push: `git remote add origin git@github.com:<your-user>/<PROJECT_SLUG>.git && git push -u origin main`
  >   3. In Cloudflare Dashboard → Workers & Pages → `<PROJECT_SLUG>` → Settings → Builds → Connect repository
  Then continue.

- **`gh` is available** ⇒
  ```bash
  gh repo create <PROJECT_SLUG> --private --source=. --push
  ```
  After success, print:
  > GitHub repo created: https://github.com/<your-user>/<PROJECT_SLUG>
  > To finish Workers Git Integration:
  >   1. Open https://dash.cloudflare.com/<account-id>/workers/services/view/<PROJECT_SLUG>/production/settings
  >   2. Under "Builds", click "Connect repository"
  >   3. Authorize Cloudflare's GitHub App and select `<PROJECT_SLUG>`
  > After this, every push to `main` auto-deploys.

(There is no fully-automated Workers Git Integration API as of 2026-05-01 — the dashboard step is mandatory. Document this clearly.)

### Apply Step 10 — Install superpowers plugin

Try the programmatic install path first:

```bash
# Add "superpowers" to .claude/settings.json's enabledPlugins array.
mkdir -p .claude
pnpm exec node --input-type=module -e '
import fs from "node:fs";
const p = ".claude/settings.json";
const cfg = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
cfg.enabledPlugins = Array.from(new Set([...(cfg.enabledPlugins ?? []), "superpowers"]));
fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
'
```

If that succeeds, print:
> superpowers plugin enabled in .claude/settings.json. Restart Claude Code (or your agent) to load it.

If it fails (e.g., the project's settings.json schema rejects the field), fall back:
> Could not auto-install superpowers. Run: `/plugin install superpowers`

(See "Stage 3 implications" in `STATUS.md` — the spec acknowledges programmatic install reliability varies; the print fallback is the never-silently-broken path.)

Commit:
```bash
git add -A
git commit -m "chore(quickstart-setup): enable superpowers plugin"
```

### Apply Step 11 — Self-remove

This is the LAST step. Remove the skill itself and the marker:

```bash
rm -f .quickstart-template
rm -rf .claude/skills/quickstart-setup
git add -A
git commit -m "chore: complete quickstart-setup; remove setup skill"
```

Print the closing message:

> ## Setup complete
>
> Project `<PROJECT_NAME>` is ready at `<project-root>`.
>
> Next steps:
>   1. Start dev: `pnpm dev` → http://localhost:3000
>   2. Deploy: read `README.md` § Deploy. The two-phase first deploy is:
>        ```
>        wrangler deploy            # captures the workers.dev URL
>        ./scripts/deploy-secrets.sh
>        echo "https://<your-worker>.workers.dev" | wrangler secret put BETTER_AUTH_URL
>        VITE_BETTER_AUTH_URL="https://<your-worker>.workers.dev" pnpm build
>        wrangler deploy
>        ```
>   3. The setup skill has self-removed. To re-run any phase, `git revert` the "complete quickstart-setup" commit.
>
> superpowers is enabled. Try `/brainstorm` or `/init`.
