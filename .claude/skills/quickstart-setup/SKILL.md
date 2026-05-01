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

[The detailed Apply-phase steps are filled in by Tasks 10–12 below — leave the section here as a placeholder pointing at "see Apply-phase substeps" until those tasks fill it in.]

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
