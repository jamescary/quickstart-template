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

## Self-removal

After all Apply substeps succeed and the final commit lands, the skill removes itself. This is the LAST step:

```bash
rm -f .quickstart-template
rm -rf .claude/skills/quickstart-setup
git add -A
git commit -m "chore: complete quickstart-setup; remove setup skill"
```

Print:
> Done. Run `pnpm dev` to start. Run `scripts/deploy-secrets.sh && wrangler deploy` when you're ready to ship.
