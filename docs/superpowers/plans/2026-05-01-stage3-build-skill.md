# Stage 3: Build the Quickstart Setup Skill

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `.claude/skills/quickstart-setup/` — the agent-driven setup skill that interviews a user, provisions Cloudflare resources, subtracts opted-out features from the templatized repo, scaffolds one starter feature, and self-removes. After this stage, the template at `/Users/jamescary/dev/quickstart-template/` is shippable: a fresh clone goes from `install.sh` to a deployed Worker via the skill.

**Architecture:** The skill is a folder of markdown files. `SKILL.md` is the orchestration entrypoint (auto-loaded); all other files are read on demand by the agent. The skill is mostly **mechanical translation** — declarative subtraction (manifest-driven file deletion + region stripping + JSON-AST edits), four sentinel substitutions, and shell-out to `wrangler` for provisioning. Only **one phase is generative**: Phase 3 (first-feature scaffold), where the agent plans + writes a minimal `Drizzle table + server function + route + component` set from a 1–2 sentence user description. Verification gates live at every phase boundary: `pnpm install` after dep-removal, `pnpm exec @better-auth/cli generate` after auth-plugin changes, `pnpm exec wrangler types` after wrangler.jsonc edits, `pnpm typecheck` after substitution, `pnpm build` before deploy.

**Tech Stack:** Markdown skill files (read by Claude Code). Tools used by the skill at runtime: `wrangler` (Cloudflare CLI), `pnpm`, `pnpm exec @better-auth/cli generate`, `pnpm exec wrangler types`, `gh` CLI (optional for git integration), Node's built-in JSONC parsing via `pnpm exec node -e ...` for `wrangler.jsonc` / `tsconfig.json` edits. No new build dependencies are added to the template by Stage 3.

**Reference inputs (read these before starting any task):**
- `docs/superpowers/specs/2026-04-30-quickstart-template-design.md` — design spec; Stage 3 section starts at line 230, "Skill structure & lifecycle" at line 130, "Interview flow" at line 158.
- `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md` — **the primary input for `manifest.json`.** Each toggle's recipe maps 1:1 to a manifest entry.
- `reference/BUILD_NOTES.md` — Stage 1 build log. The provider walkthroughs in Task 7 (line 514) and Resend setup in Task 9 (line 648) are copied verbatim into `credentials.md`. The two-phase deploy + `VITE_BETTER_AUTH_URL` discovery in Task 13 (line 936) is the source for the deploy section of `cloudflare.md`.
- `STATUS.md` — current project status; lists every "Stage 3 should preserve verbatim" pattern.
- The templatized files at the repo root (`src/`, `tests/`, `wrangler.jsonc`, `package.json`, `.dev.vars.example`, etc.) — read these as needed when writing the manifest entries.

---

## Pre-flight checklist (run once before Task 1)

- [ ] **Verify Stage 2 is complete and committed.**
  ```bash
  cd /Users/jamescary/dev/quickstart-template
  git status
  git log --oneline -5
  ```
  Expected: clean working tree; recent commits mention "Stage 2 complete" and Task 13 / "bootstrap files".

- [ ] **Verify the template typechecks at-rest.**
  ```bash
  cd /Users/jamescary/dev/quickstart-template
  pnpm exec tsc --noEmit
  ```
  Expected: passes. (Per STATUS.md: `pnpm build` and `pnpm test` *do not* pass at this stage — that's expected because `__PROJECT_SLUG__` isn't a valid wrangler name. `tsc --noEmit` is the at-rest verification floor.)

- [ ] **Verify the four sentinels exist in the expected places.**
  ```bash
  grep -rEn '__PROJECT_(NAME|SLUG|DESCRIPTION)__|__BRAND_COLOR__' \
    src README.md wrangler.jsonc package.json install.sh install.md
  ```
  Expected output: 10 lines (the same set previously enumerated in `STATUS.md` Stage 2 patterns). If any sentinel is missing, stop and resolve before proceeding.

- [ ] **Verify the bootstrap files are present.**
  ```bash
  ls .quickstart-template install.sh install.md README.md
  ```
  Expected: all four exist.

- [ ] **Confirm no skill directory yet exists.**
  ```bash
  ls .claude/skills/quickstart-setup 2>/dev/null && echo "EXISTS — abort" || echo "OK"
  ```
  Expected: `OK`. If the directory exists, this plan has already partially run; check `git log` and decide whether to `git reset` to a clean baseline.

- [ ] **Create a Stage 3 working notes file.**
  ```bash
  : > /Users/jamescary/dev/quickstart-template/STAGE3_NOTES.md
  ```
  Append per-task notes as you go. At the end of Stage 3, fold the relevant content into `STATUS.md` and delete this scratch file.

---

## Conventions (read before any task)

### File-vs-skill distinction

This plan **builds skill files**. The skill files **describe the behavior** the agent will perform when the skill is later invoked. Do not confuse the two layers:

- A **plan task** like "write the Apply-phase steps to SKILL.md" produces *prose + shell commands* that a future agent will execute.
- The **skill at runtime** is what actually mutates the user's project.

Where a plan task says "write X into SKILL.md", what's being written is *agent-readable instructions*, not executable code. Use Markdown headings, numbered lists, and fenced shell blocks. Be explicit about command output expectations and what to do on failure.

### Skill file layout (the output of this plan)

```
.claude/skills/quickstart-setup/
├── SKILL.md                 # frontmatter + orchestration; only file auto-loaded
├── interview.md             # question scripts for each phase
├── manifest.json            # toggle → files-to-delete + region-tags-to-strip + JSON-AST edits
├── cloudflare.md            # wrangler command sequences and output parsers
├── credentials.md           # per-OAuth-provider walkthroughs (links, callback URLs, env keys)
├── scaffold-feature.md      # rules for planning + writing the first feature
└── TEMPLATE_URL             # plain text file: template repo URL (used by global mode)
```

Sub-files are **read on demand** during their phase. The agent should NOT pre-load all sub-files at session start; the skill explicitly tells it when to `Read` each one.

### Phase ↔ file map

| Phase | Driven by | Verification gate |
|---|---|---|
| Entry detection | `SKILL.md` § Entry detection | Marker present + clean dir |
| 1: Identity | `interview.md` § Phase 1 | 4 answers captured |
| 2: Toggles | `interview.md` § Phase 2 | 6 toggle answers captured |
| 3: Feature description | `interview.md` § Phase 3 | 1-2 sentence description captured |
| 4: Cloudflare provisioning | `cloudflare.md` | D1 ID + KV ID written into wrangler.jsonc; `wrangler d1 migrations apply --local` succeeds |
| 5: Credentials | `credentials.md` | `.dev.vars` written (or skipped per provider) |
| 6: Confirmation | `interview.md` § Phase 6 | User explicit "yes" |
| 7: Apply | `SKILL.md` § Apply phase | `pnpm typecheck` + `pnpm build` succeed; final commit recorded |

### Manifest schema (used by the Apply phase)

`manifest.json` is the declarative subtraction spec. Every toggle has zero or more of these op kinds:

| Op | Meaning |
|---|---|
| `delete` | Whole-file or whole-directory deletion. Path is repo-relative. Directories are removed if empty after listed files are deleted. |
| `strip` | Remove every `// #region quickstart:if=<toggle>` ... `// #endregion` block in the named file (or its JSX/CSS/shell variant). The skill scans top-down; nested regions strip outer-first. |
| `edit_json` | Plain JSON edit (currently used only for `package.json`) with explicit operation: `remove_key` (delete a key from an object). Implemented via `JSON.parse` / `JSON.stringify` with 2-space indent. |
| `replace_file` | Overwrite a file with the supplied inline content. Used when subtraction would leave malformed code (e.g., `tests/worker-entry.ts` with `do` off). |

Toggle names (must match `manifest.json` keys exactly):
- `resend`
- `org`
- `oauth.github`
- `oauth.google`
- `do`
- `vitest`

### Region-marker grep patterns

When the skill strips, it greps for these line forms (matching the toggle from the manifest entry):

| File extensions | Open marker pattern | Close marker pattern |
|---|---|---|
| `.ts` `.tsx` `.js` `.jsonc` | `^\s*// #region quickstart:if=<TOGGLE>\s*$` | `^\s*// #endregion\s*$` |
| `.tsx` (JSX-position) | `^\s*\{/\* #region quickstart:if=<TOGGLE> \*/\}\s*$` | `^\s*\{/\* #endregion \*/\}\s*$` |
| `.css` | `^\s*/\* #region quickstart:if=<TOGGLE> \*/\s*$` | `^\s*/\* #endregion \*/\s*$` |
| `.env` `.dev.vars*` shell | `^# #region quickstart:if=<TOGGLE>\s*$` | `^# #endregion\s*$` |

The match is whole-line. Markers are stripped along with the body. Plain `// #endregion` matches **any** open marker (including non-quickstart ones); the skill must pair markers by depth, not by tag.

### Sentinel substitution

Four substitutions, performed globally across the project (after subtraction, before schema regen):

| Sentinel | Source | Treatment |
|---|---|---|
| `__PROJECT_NAME__` | Identity Q1 | Verbatim find/replace |
| `__PROJECT_SLUG__` | Identity Q2 (default = kebab-case of Q1) | Verbatim find/replace; must match `[a-z0-9-]+` |
| `__PROJECT_DESCRIPTION__` | Identity Q3 | Verbatim find/replace; sanitize quotes for JSON contexts (escape `"`) |
| `__BRAND_COLOR__` | Identity Q4 (default `#0F172A`) | Verbatim find/replace + a separate hex→HSL conversion patches `src/styles.css` `--primary` (see Apply Step 3) |

### Resource ID overwrites (not sentinels)

Stage 2 wrote zero placeholders for `wrangler.jsonc` resource IDs. The skill **overwrites these by binding name**, not by detecting placeholder text:

| Field selector | Source |
|---|---|
| `d1_databases[].database_id` where `binding == "DB"` | `wrangler d1 create` parsed output |
| `kv_namespaces[].id` where `binding == "KV"` | `wrangler kv namespace create` parsed output |

### Verification commands (used throughout the Apply phase)

```bash
cd <project-root>
pnpm install                           # rebuild lockfile after dep removals
pnpm exec @better-auth/cli generate \  # regenerate src/db/auth-schema.ts post-plugin-strip
  --config src/lib/auth/server.ts \
  --output src/db/auth-schema.ts --yes
pnpm exec wrangler types               # regenerate worker-configuration.d.ts post wrangler.jsonc edits
rm -f drizzle/migrations/*.sql         # drop reference's migrations
rm -rf drizzle/migrations/meta         # drop snapshot dir if present (gitignored anyway)
pnpm db:generate                       # produce a fresh 0000 migration from the regenerated schema
pnpm exec tsc --noEmit                 # typecheck gate
pnpm build                             # vite build (only meaningful after sentinel substitution)
pnpm test                              # vitest run (only if vitest toggle is on)
```

### Idempotency / re-run posture

If the skill runs a second time in a directory it has already processed:

- The marker file `.quickstart-template` is already deleted ⇒ entry detection aborts cleanly with: "This directory was already set up by `quickstart-setup`. To re-run, `git revert` the final 'self-removal' commit and try again."
- Wrangler resource creation re-runs (`wrangler d1 list`, `wrangler kv namespace list`) check existing names before creating: if a resource with the slug-derived name already exists, the skill picks up its ID rather than creating a duplicate.

---

## File structure (output of Stage 3)

After all tasks complete, `/Users/jamescary/dev/quickstart-template/` has these new files:

```
.claude/
└── skills/
    └── quickstart-setup/
        ├── SKILL.md
        ├── interview.md
        ├── manifest.json
        ├── cloudflare.md
        ├── credentials.md
        ├── scaffold-feature.md
        └── TEMPLATE_URL
```

`STATUS.md` is updated to reflect Stage 3 completion. Bootstrap files (`install.sh`, `install.md`) have `__GH_USER__` replaced (Task 16). No source files are otherwise modified.

---

## Task 1: Skill directory + SKILL.md skeleton

**Files:**
- Create: `.claude/skills/quickstart-setup/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p .claude/skills/quickstart-setup
```

Expected: directory exists; `ls .claude/skills/quickstart-setup` returns nothing yet.

- [ ] **Step 2: Write the SKILL.md skeleton**

Write `.claude/skills/quickstart-setup/SKILL.md` with this exact content (the body sections are filled in by later tasks; this skeleton fixes the frontmatter and the lifecycle outline):

````markdown
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
````

(The `[ ... ]` placeholder at "Phase 7 — Apply" gets replaced in Tasks 10–12. Leave it for now.)

- [ ] **Step 3: Verify the skeleton**

```bash
ls -la .claude/skills/quickstart-setup/
cat .claude/skills/quickstart-setup/SKILL.md | head -20
```

Expected: SKILL.md exists, frontmatter is the first block.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/quickstart-setup/SKILL.md
git commit -m "feat(stage3): scaffold quickstart-setup SKILL.md skeleton"
```

---

## Task 2: TEMPLATE_URL placeholder file

**Files:**
- Create: `.claude/skills/quickstart-setup/TEMPLATE_URL`

- [ ] **Step 1: Write TEMPLATE_URL with the publish-time placeholder**

The actual URL gets filled in at template-publishing time (Task 16) when the GitHub user/org is known. For now, use the same `__GH_USER__` placeholder used in `install.sh` and `install.md`:

```bash
printf 'https://github.com/__GH_USER__/quickstart-template.git\n' > .claude/skills/quickstart-setup/TEMPLATE_URL
```

- [ ] **Step 2: Verify**

```bash
cat .claude/skills/quickstart-setup/TEMPLATE_URL
```

Expected: `https://github.com/__GH_USER__/quickstart-template.git` (one line).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/TEMPLATE_URL
git commit -m "feat(stage3): add TEMPLATE_URL placeholder (publish-time substitution)"
```

---

## Task 3: Sub-file stubs

**Files:**
- Create: `.claude/skills/quickstart-setup/interview.md`
- Create: `.claude/skills/quickstart-setup/cloudflare.md`
- Create: `.claude/skills/quickstart-setup/credentials.md`
- Create: `.claude/skills/quickstart-setup/scaffold-feature.md`

These are populated by later tasks. Stub them now so SKILL.md's `Read` calls don't fail mid-development.

- [ ] **Step 1: Create the four stubs**

Each file gets a one-line header and a "TODO: populated by Stage 3 Task N" line. Use `printf` so we don't trip the `NEVER create documentation files` heuristic — these are skill payload, not user-facing docs.

```bash
printf '# quickstart-setup interview\n\n_Filled in by Stage 3 Tasks 4–6._\n' > .claude/skills/quickstart-setup/interview.md
printf '# quickstart-setup cloudflare provisioning\n\n_Filled in by Stage 3 Task 7._\n' > .claude/skills/quickstart-setup/cloudflare.md
printf '# quickstart-setup credentials walkthroughs\n\n_Filled in by Stage 3 Task 8._\n' > .claude/skills/quickstart-setup/credentials.md
printf '# quickstart-setup first-feature scaffolding\n\n_Filled in by Stage 3 Task 9._\n' > .claude/skills/quickstart-setup/scaffold-feature.md
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/quickstart-setup/{interview,cloudflare,credentials,scaffold-feature}.md
git commit -m "feat(stage3): stub interview/cloudflare/credentials/scaffold-feature"
```

---

## Task 4: manifest.json — declarative subtraction spec

**Files:**
- Create: `.claude/skills/quickstart-setup/manifest.json`

This file is the source of truth for what each toggle removes. Each entry derives 1:1 from `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`. Re-read that file before writing.

- [ ] **Step 1: Write the manifest**

Write `.claude/skills/quickstart-setup/manifest.json` with this exact content:

```json
{
  "$schema": "internal://quickstart-setup-manifest-v1",
  "toggles": {
    "resend": {
      "description": "Resend transactional email — when off, falls back to dev console logger.",
      "delete": [
        "src/server/email.ts"
      ],
      "strip": [
        { "file": "src/lib/auth/server.ts", "tag": "resend" },
        { "file": ".dev.vars.example", "tag": "resend" }
      ],
      "edit_json": [
        { "file": "package.json", "op": "remove_key", "path": ["dependencies", "resend"] }
      ]
    },
    "org": {
      "description": "better-auth organization plugin — orgs, members, invitations.",
      "delete": [
        "src/routes/dashboard/org/index.tsx",
        "src/routes/dashboard/org/invite.tsx",
        "src/routes/dashboard/org",
        "src/components/org-switcher.tsx"
      ],
      "strip": [
        { "file": "src/lib/auth/server.ts", "tag": "org" },
        { "file": "src/lib/auth/client.ts", "tag": "org" },
        { "file": "src/routes/dashboard/route.tsx", "tag": "org" },
        { "file": "tests/auth.test.ts", "tag": "org" }
      ],
      "edit_json": []
    },
    "oauth.github": {
      "description": "GitHub OAuth provider.",
      "delete": [],
      "strip": [
        { "file": "src/lib/auth/server.ts", "tag": "oauth.github" },
        { "file": "src/components/auth/oauth-buttons.tsx", "tag": "oauth.github" },
        { "file": ".dev.vars.example", "tag": "oauth.github" }
      ],
      "edit_json": []
    },
    "oauth.google": {
      "description": "Google OAuth provider.",
      "delete": [],
      "strip": [
        { "file": "src/lib/auth/server.ts", "tag": "oauth.google" },
        { "file": "src/components/auth/oauth-buttons.tsx", "tag": "oauth.google" },
        { "file": ".dev.vars.example", "tag": "oauth.google" }
      ],
      "edit_json": []
    },
    "do": {
      "description": "Example Durable Object (real-time presence widget).",
      "delete": [
        "src/server/presence-do.ts",
        "src/components/presence-widget.tsx",
        "src/routes/api/presence/$.ts",
        "src/routes/api/presence",
        "tests/presence.test.ts"
      ],
      "strip": [
        { "file": "src/server.ts", "tag": "do" },
        { "file": "src/routes/dashboard/index.tsx", "tag": "do" },
        { "file": "wrangler.jsonc", "tag": "do" }
      ],
      "edit_json": [],
      "replace_file": [
        {
          "file": "tests/worker-entry.ts",
          "content": "export default { fetch() { return new Response('test worker'); } };\n"
        }
      ]
    },
    "vitest": {
      "description": "Vitest + @cloudflare/vitest-pool-workers.",
      "delete": [
        "tests/auth.test.ts",
        "tests/kv.test.ts",
        "tests/presence.test.ts",
        "tests/setup.ts",
        "tests/worker-entry.ts",
        "tests",
        "vitest.config.ts"
      ],
      "strip": [
        { "file": "tsconfig.json", "tag": "vitest" }
      ],
      "edit_json": [
        { "file": "package.json", "op": "remove_key", "path": ["scripts", "test"] },
        { "file": "package.json", "op": "remove_key", "path": ["scripts", "test:watch"] },
        { "file": "package.json", "op": "remove_key", "path": ["devDependencies", "@cloudflare/vitest-pool-workers"] },
        { "file": "package.json", "op": "remove_key", "path": ["devDependencies", "@testing-library/dom"] },
        { "file": "package.json", "op": "remove_key", "path": ["devDependencies", "@testing-library/react"] },
        { "file": "package.json", "op": "remove_key", "path": ["devDependencies", "jsdom"] },
        { "file": "package.json", "op": "remove_key", "path": ["devDependencies", "vitest"] }
      ]
    }
  },
  "post_subtraction_combinatorial": {
    "no_oauth_providers": {
      "description": "When BOTH oauth.github AND oauth.google are off, the OAuthButtons component renders empty. Delete it and clean up its callers.",
      "condition": "!toggles['oauth.github'] && !toggles['oauth.google']",
      "delete": [
        "src/components/auth/oauth-buttons.tsx"
      ],
      "regex_strip": [
        {
          "file": "src/routes/login.tsx",
          "patterns": [
            "^\\s*import \\{ OAuthButtons \\} from \"@/components/auth/oauth-buttons\";\\s*$",
            "^\\s*<OAuthButtons />\\s*$",
            "^\\s*<div className=\"my-4 text-center text-xs text-muted-foreground\">or</div>\\s*$"
          ]
        },
        {
          "file": "src/routes/signup.tsx",
          "patterns": [
            "^\\s*import \\{ OAuthButtons \\} from \"@/components/auth/oauth-buttons\";\\s*$",
            "^\\s*<OAuthButtons />\\s*$",
            "^\\s*<div className=\"my-4 text-center text-xs text-muted-foreground\">or</div>\\s*$"
          ]
        }
      ]
    }
  }
}
```

- [ ] **Step 2: Validate the JSON**

```bash
pnpm exec node -e 'JSON.parse(require("fs").readFileSync(".claude/skills/quickstart-setup/manifest.json","utf8")); console.log("OK")'
```

Expected: `OK`. If it errors, fix the JSON syntax.

- [ ] **Step 3: Cross-check against the recipe doc**

For each toggle, eyeball that every `delete` / `strip` / `edit_json` entry in the manifest also appears in the corresponding section of `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`. If the recipe doc lists something the manifest is missing (or vice versa), fix the manifest.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/quickstart-setup/manifest.json
git commit -m "feat(stage3): write manifest.json — toggle → delete/strip/edit ops"
```

---

## Task 5: Document the subtraction algorithm in SKILL.md

The Apply phase needs a precise algorithm for executing `manifest.json`. Document it once, in SKILL.md, so the agent has a single reference.

**Files:**
- Modify: `.claude/skills/quickstart-setup/SKILL.md`

- [ ] **Step 1: Add a "Subtraction algorithm" section to SKILL.md**

Insert the following section AFTER the `## Self-removal` heading is reached — actually, put it just BEFORE the `## Phase 7 — Apply` heading, so it's read in lifecycle order:

````markdown
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
````

- [ ] **Step 2: Verify SKILL.md still parses as valid Markdown**

```bash
head -100 .claude/skills/quickstart-setup/SKILL.md
```

Eyeball the frontmatter is intact and the "Subtraction algorithm" section is in the right place.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/SKILL.md
git commit -m "feat(stage3): document subtraction algorithm in SKILL.md"
```

---

## Task 6: interview.md — Phases 1, 2, 3, 6

**Files:**
- Modify: `.claude/skills/quickstart-setup/interview.md`

The user-facing question scripts. Each phase has explicit, copy-pasteable prompts the agent should ask, with default values, validation rules, and what to do if the answer is invalid.

- [ ] **Step 1: Replace the stub with the full content**

Write `.claude/skills/quickstart-setup/interview.md` with this exact content:

````markdown
# quickstart-setup interview

This file contains the question scripts for Phases 1, 2, 3, and 6. Phases 4 (Cloudflare) and 5 (Credentials) live in their own files because they are command-driven rather than purely interview-driven.

**Tone:** terse, friendly, agent-style. One question at a time. Default values shown in `[brackets]`; the user pressing Enter accepts the default. Re-prompt on invalid input with a one-line explanation.

---

## Phase 1 — Identity

Ask in this order:

### Q1. Display name
> What's the display name of your project? (e.g., "Notepad", "Acme CRM")

- Required, non-empty, ≤ 60 chars.
- Re-prompt if blank.
- Capture as `PROJECT_NAME`.

### Q2. Project codename / slug
> Project slug for `package.json`, `wrangler.jsonc`, and the deploy URL? Default: kebab-case of the display name. [<kebab-case-default>]

- Default: lowercase of `PROJECT_NAME`, replace whitespace and `_` with `-`, drop any character not in `[a-z0-9-]`.
- Validation: must match `^[a-z][a-z0-9-]*$` AND be 1–63 chars (Cloudflare worker name rule).
- Re-prompt with: "Slug must be lowercase, start with a letter, and contain only letters, digits, and hyphens."
- Capture as `PROJECT_SLUG`.

### Q3. One-sentence description
> One-sentence description of the project? (Used in `package.json`, README, and the landing page.)

- Required, non-empty.
- Capture as `PROJECT_DESCRIPTION`. The skill will JSON-escape this when writing into `package.json` (escape `"` and `\`).

### Q4. Brand color
> Brand color (hex, e.g., `#0F172A`)? [#0F172A]

- Default: `#0F172A`.
- Validation: must match `^#[0-9a-fA-F]{6}$` (six-digit hex). Three-digit shorthand and `rgb()` are rejected.
- Capture as `BRAND_COLOR`.

---

## Phase 2 — Feature toggles

### Q5. OAuth providers
> Which OAuth providers do you want? (Pick any: GitHub, Google, none)

- The reference template ships GitHub and Google. Discord/Apple are mentioned in the spec as future additions but are NOT supported in this build — if the user names an unsupported provider, say: "GitHub and Google are supported in this build. Pick any subset (or 'none')."
- Capture as two booleans: `toggles["oauth.github"]` and `toggles["oauth.google"]`.

### Q6. Organization / teams plugin
> Use the better-auth organization plugin? (Y/n) — Adds orgs, member roles, invitations.

- Default: `n`.
- Capture as `toggles["org"]`.

### Q7. Resend (transactional email)
> Use Resend for transactional email? (Y/n) — Without it, dev mode logs emails to console. (Note: org-plugin invitation emails depend on this; if `org` is on but `resend` is off, invitations will only show up in console logs locally and won't be sent in production.)

- Default: `n`.
- Capture as `toggles["resend"]`.

### Q8. Durable Object example
> Include the example Durable Object (real-time presence widget on the dashboard)? (Y/n)

- Default: `n`.
- Capture as `toggles["do"]`.

### Q9. Vitest
> Include vitest setup with example tests against the Cloudflare Workers pool? (Y/n)

- Default: `y` (recommended for any non-trivial project; re-running `pnpm test` validates the project after every change).
- Capture as `toggles["vitest"]`.

### Q10. Cloudflare Workers Git Integration
> Set up Cloudflare Workers Git Integration for auto-deploy on push? (Y/n) — If yes, the skill will create a GitHub repo via `gh repo create` during Phase 7 and walk you through connecting it. Requires `gh` CLI authenticated; if it's not, the skill will skip and print manual setup steps.

- Default: `n`.
- Capture as `WORKERS_GIT_INTEGRATION`.

---

## Phase 3 — First-feature scaffold

### Q11. Feature description
> Describe the first feature in 1–2 sentences. (e.g., "a notes app with shared workspaces" or "a habit tracker with daily check-ins"). The skill will plan a minimal scaffold from this — one Drizzle table, one server function, one route, one component — and show you the plan before writing.

- Required, non-empty, ≤ 400 chars.
- Capture as `FEATURE_DESCRIPTION`.
- Note: the actual scaffold planning happens in Phase 7 (Apply Step 6); this question just captures the description.

---

## Phase 6 — Final confirmation

After Phases 4 and 5 complete, print a summary block and ask for explicit confirmation. Format:

```
About to apply the following changes to <project-root>:

  Identity
    Name:        <PROJECT_NAME>
    Slug:        <PROJECT_SLUG>
    Description: <PROJECT_DESCRIPTION>
    Brand color: <BRAND_COLOR>

  Toggles ON:  <comma-separated list of toggles where value=true>
  Toggles OFF: <comma-separated list of toggles where value=false>

  Cloudflare resources (provisioned in Phase 4):
    Worker name: <PROJECT_SLUG>
    D1 database: <PROJECT_SLUG>-db (id: <D1_ID>)
    KV namespace: <PROJECT_SLUG>-kv (id: <KV_ID>)

  OAuth credentials captured for: <providers list, or "none">
  Resend key captured: <yes / no / skipped>
  Workers Git Integration: <yes / no / skipped (gh missing)>

  First feature: <FEATURE_DESCRIPTION>

Proceed? (yes / no)
```

- Accept only literal `yes` (case-insensitive). Anything else aborts: print "Aborted. No changes have been written to source files. Cloudflare resources <D1_ID> and <KV_ID> were created — delete them with `wrangler d1 delete <slug>-db` and `wrangler kv namespace delete --namespace-id <KV_ID>` if you don't want to keep them." and exit.
- On `yes`, proceed to Phase 7.

---

## Notes

- **Re-runs of a single question.** The user can say "wait, change Q3" mid-flow. Until Phase 6 confirmation, allow this — re-ask the named question and update the stored answer. After Phase 6 there is no rewind; the user must abort and start over.
- **Storage of answers.** During Phases 1–5 the answers live in your working memory only. Do NOT write them to disk until Phase 7 (the final commit boundary).
````

- [ ] **Step 2: Spot-check**

```bash
head -40 .claude/skills/quickstart-setup/interview.md
grep -c "^### Q" .claude/skills/quickstart-setup/interview.md
```

Expected: 11 questions (`Q1` through `Q11`).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/interview.md
git commit -m "feat(stage3): write interview.md (Phases 1, 2, 3, 6)"
```

---

## Task 7: cloudflare.md — Phase 4 provisioning

**Files:**
- Modify: `.claude/skills/quickstart-setup/cloudflare.md`

Source material: `reference/BUILD_NOTES.md` Task 2 (line 83), Task 13 (line 936), and STATUS.md "patterns Stage 3 should preserve verbatim". The file documents wrangler commands, output parsing, idempotency, and the two-phase deploy / `VITE_BETTER_AUTH_URL` story.

- [ ] **Step 1: Write cloudflare.md**

Replace the stub with this exact content:

````markdown
# quickstart-setup — Phase 4: Cloudflare provisioning

This phase creates the D1 database and KV namespace, writes their IDs into `wrangler.jsonc`, applies initial migrations to local D1, and regenerates `worker-configuration.d.ts`. **No questions to the user except picking an account if `wrangler whoami` returns multiple.**

## Prerequisites check

```bash
wrangler --version
```

Expected: a version string. If `wrangler` is not installed, abort with: "Wrangler is required. Install with `pnpm add -D wrangler` or `npm i -g wrangler` and re-run."

## Step 1 — Authentication

```bash
wrangler whoami
```

- **If output contains `You are logged in with the OAuth Token`** ⇒ proceed.
- **If output is `You are not authenticated`** ⇒ run:
  ```bash
  wrangler login
  ```
  This opens a browser. Tell the user: "A browser window should open. Authorize the OAuth flow, then return here."
- **If multiple accounts are listed** (the OAuth user has access to several Cloudflare accounts) ⇒ ask the user:
  > Which Cloudflare account should this project use? <numbered list of accounts>
  Capture the chosen account ID. Set `CLOUDFLARE_ACCOUNT_ID` for subsequent commands by exporting it in the shell session: `export CLOUDFLARE_ACCOUNT_ID=<chosen-id>`.

## Step 2 — D1 database

### Idempotent existence check

```bash
wrangler d1 list --json
```

Parse the JSON output (an array of `{ uuid, name, ... }`). If a database named `<PROJECT_SLUG>-db` already exists, capture its `uuid` as `D1_ID` and skip the create step.

### Create

```bash
wrangler d1 create <PROJECT_SLUG>-db
```

Sample output:
```
✅ Successfully created DB '<PROJECT_SLUG>-db'

[[d1_databases]]
binding = "DB"
database_name = "<PROJECT_SLUG>-db"
database_id = "a5f78b53-2e29-4f68-ab1b-262df76ef691"
```

Wrangler runs in non-interactive mode here and **declines its own offer to write the snippet into `wrangler.jsonc`** ("🤖 Using fallback value in non-interactive context: no"). That is correct — we write the binding ourselves so we control the binding name (`DB`) and `migrations_dir`.

Parse `database_id` from the output: match `database_id = "([0-9a-f-]+)"`. Capture as `D1_ID`.

### Write into wrangler.jsonc

Stage 2 wrote a unique zero-placeholder for `database_id` (`00000000-0000-0000-0000-000000000000`). Replace it via `sed`:

```bash
sed -i '' "s|00000000-0000-0000-0000-000000000000|<D1_ID>|" wrangler.jsonc
```

Verify exactly one replacement happened:
```bash
grep -c '<D1_ID>' wrangler.jsonc | grep -q '^1$' && echo "D1 ID written: OK"
```

(Note: `database_name` was already written as `<PROJECT_SLUG>-db` by sentinel substitution; we don't touch it here. The `database_id` zero-placeholder appears nowhere else in the template — it's a safe unique target for sed.)

## Step 3 — KV namespace

### Idempotent existence check

```bash
wrangler kv namespace list
```

Parse the table-format output. If a namespace named `<PROJECT_SLUG>-kv` exists, capture its ID as `KV_ID` and skip create.

### Create

```bash
wrangler kv namespace create <PROJECT_SLUG>-kv
```

Sample output:
```
✅ Created namespace with title "<worker-name>-<PROJECT_SLUG>-kv" with ID "5c21b215d76c49038e680801d92f5518"
```

Note: wrangler prepends the worker name to the namespace title automatically. The `id` is the only thing we need — it's the canonical reference.

Parse `ID "([0-9a-f]+)"` (32-char hex). Capture as `KV_ID`.

### Write into wrangler.jsonc

KV's zero-placeholder is `00000000000000000000000000000000` (32 hex zeros — distinguishable from the D1 UUID pattern). Replace via `sed`:

```bash
sed -i '' "s|00000000000000000000000000000000|<KV_ID>|" wrangler.jsonc
```

Verify:
```bash
grep -c '<KV_ID>' wrangler.jsonc | grep -q '^1$' && echo "KV ID written: OK"
```

## Step 4 — Initial migration apply (local only)

The skill regenerates `drizzle/migrations/` later (in the Apply phase, after `auth-schema.ts` regeneration). At this Phase 4 stage, just verify wrangler can talk to the new D1:

```bash
wrangler d1 execute <PROJECT_SLUG>-db --local --command "SELECT 1 AS ok"
```

Expected: `[{ "ok": 1 }]`. If it errors with "wrangler.jsonc validation failed", the sentinel substitution has not yet run — you are in the wrong phase order. Phase 4 runs **before** sentinel substitution but **after** the D1/KV IDs are written (which happened in Steps 2 and 3 above), and `name` in wrangler.jsonc is still `__PROJECT_SLUG__`. Two options:
1. Defer the migration apply to Apply Step 5 (after sentinel substitution).
2. Pass `--config /dev/null` and inline the connection string. (Don't do this — it's brittle.)

**Decision: defer.** Move the actual `wrangler d1 migrations apply` call to Apply Step 5, immediately after sentinel substitution makes the worker name valid. Phase 4 only writes IDs into wrangler.jsonc and verifies wrangler can authenticate.

## Step 5 — Worker-types regeneration (DEFERRED to Apply phase)

Same reason: `wrangler types` requires a valid wrangler.jsonc, which means sentinels must be substituted first. Phase 4 leaves `worker-configuration.d.ts` as it was at Stage 2 commit time. The Apply phase regenerates it after substitution + sentinel pass.

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| `wrangler d1 create` returns "name already in use" | a previous skill run was interrupted | The idempotent existence check should have caught this — re-run Step 2's existence check; if the name shows up, capture its ID and continue. |
| `wrangler login` browser tab doesn't open | headless terminal | Print the OAuth URL and tell the user to open it manually. |
| HTTP 403 from any wrangler command | wrong account / no Workers Paid plan | Ask the user to verify their account at `https://dash.cloudflare.com/`. |

## Outputs of Phase 4

- `wrangler.jsonc` updated with real `D1_ID` and `KV_ID`.
- Working memory variables: `D1_ID`, `KV_ID`, `CLOUDFLARE_ACCOUNT_ID` (if multi-account).
- Resources visible in `wrangler d1 list` and `wrangler kv namespace list`.

Phase 4 does **NOT** commit yet — Phase 7's Apply step does the per-step commits.
````

- [ ] **Step 2: Verify**

```bash
head -40 .claude/skills/quickstart-setup/cloudflare.md
grep -c "^## Step" .claude/skills/quickstart-setup/cloudflare.md
```

Expected: 5 step headings.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/cloudflare.md
git commit -m "feat(stage3): write cloudflare.md (Phase 4 provisioning)"
```

---

## Task 8: credentials.md — Phase 5 walkthroughs

**Files:**
- Modify: `.claude/skills/quickstart-setup/credentials.md`

Source: `reference/BUILD_NOTES.md` Task 7 (line 514) and Task 9 (line 648). Copy the provider walkthroughs verbatim — they are the literal source of truth for what the user is asked.

- [ ] **Step 1: Write credentials.md**

Replace the stub with this exact content:

````markdown
# quickstart-setup — Phase 5: Credentials

For each chosen OAuth provider AND for Resend (if `toggles.resend == true`), walk the user through the provider console, show the exact callback URL to register, and collect the API credentials. Skipping is allowed — the user can fill in `.dev.vars` later.

## Output: `.dev.vars`

The reference's `.dev.vars` (gitignored) has this shape after Phase 5:

```
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=http://localhost:3000

GITHUB_CLIENT_ID=<value or empty>
GITHUB_CLIENT_SECRET=<value or empty>

GOOGLE_CLIENT_ID=<value or empty>
GOOGLE_CLIENT_SECRET=<value or empty>

RESEND_API_KEY=<value or empty>
RESEND_FROM_EMAIL=onboarding@resend.dev
```

The skill writes `.dev.vars` (NOT `.dev.vars.example`) — these are real secrets for local dev. `.dev.vars` is already gitignored in the template.

### `BETTER_AUTH_SECRET`

Auto-generated; never asked. The skill runs:
```bash
openssl rand -base64 32
```
and writes the result as `BETTER_AUTH_SECRET=<value>`.

### `BETTER_AUTH_URL`

For local dev, always `http://localhost:3000`. (Production secret is set later via `wrangler secret put` — see "Production secrets" below.)

---

## GitHub OAuth (only if `toggles["oauth.github"] == true`)

Print this verbatim to the user:

> ## GitHub OAuth setup
>
> 1. Open `https://github.com/settings/applications/new`
> 2. Application name: `<PROJECT_NAME> (dev)`
> 3. Homepage URL: `http://localhost:3000`
> 4. **Authorization callback URL: `http://localhost:3000/api/auth/callback/github`**
> 5. Click "Register application"
> 6. On the resulting page: copy the **Client ID** (visible).
> 7. Click "Generate a new client secret" — copy the **Client Secret** (visible once; regenerate if you miss it).
>
> Paste them here:

Then ask:
- "GitHub Client ID? (or press Enter to skip)" → capture `GITHUB_CLIENT_ID` (may be empty).
- "GitHub Client Secret? (or press Enter to skip)" → capture `GITHUB_CLIENT_SECRET`.

If both are empty, that's fine — the GitHub button on the login UI will return `PROVIDER_NOT_FOUND` until creds are added.

**Production callback URL** (the user adds this to the same GitHub OAuth app later, when they have a deployed URL):
- `https://<PROJECT_SLUG>.<workers-subdomain>.workers.dev/api/auth/callback/github`

---

## Google OAuth (only if `toggles["oauth.google"] == true`)

Print this verbatim:

> ## Google OAuth setup
>
> 1. Open `https://console.cloud.google.com/apis/credentials`
> 2. **First-time setup:** configure the OAuth consent screen:
>    - User Type: External
>    - Fill app name + support email + developer contact
>    - Under "Test Users" add your email if publish status is "Testing"
> 3. "+ CREATE CREDENTIALS" → "OAuth client ID"
> 4. Application type: **Web application**
> 5. **Authorized redirect URIs (add both):**
>    - `http://localhost:3000/api/auth/callback/google`
>    - `https://<PROJECT_SLUG>.<workers-subdomain>.workers.dev/api/auth/callback/google` (you can come back and add this once you've deployed)
> 6. Skip "Authorized JavaScript Origins" — better-auth uses the server-side code flow only.
> 7. Click "Create" — Client ID + Secret appear in a modal. **Copy both before closing.**
>
> Paste them here:

Ask:
- "Google Client ID? (or press Enter to skip)" → `GOOGLE_CLIENT_ID`.
- "Google Client Secret? (or press Enter to skip)" → `GOOGLE_CLIENT_SECRET`.

---

## Resend (only if `toggles["resend"] == true`)

Print this verbatim:

> ## Resend API key setup
>
> 1. Sign up (free) at `https://resend.com/`. Free tier: 100 emails/day, 3,000/month, 1 verified domain.
> 2. **For quick testing only:** without a verified domain, you can send to your own Resend-account email using `from: onboarding@resend.dev`. To send to arbitrary recipients, verify a domain at `https://resend.com/domains` (add SPF + DKIM DNS records).
> 3. Open `https://resend.com/api-keys` → "Create API Key" → copy the value (starts with `re_`).
>
> Paste it here:

Ask:
- "Resend API key? (or press Enter to skip)" → `RESEND_API_KEY`.
- "Resend FROM email? [onboarding@resend.dev]" → `RESEND_FROM_EMAIL` (default `onboarding@resend.dev`).

If the user skips, leave both blank — `createEmailer` falls back to dev console logging when `RESEND_API_KEY` is empty.

---

## Writing `.dev.vars`

After all provider sections complete, write `.dev.vars` to the project root with the captured values. Use this template (lines for empty values still appear, with empty value):

```bash
cat > .dev.vars <<EOF
BETTER_AUTH_SECRET=<generated>
BETTER_AUTH_URL=http://localhost:3000

GITHUB_CLIENT_ID=<value>
GITHUB_CLIENT_SECRET=<value>

GOOGLE_CLIENT_ID=<value>
GOOGLE_CLIENT_SECRET=<value>

RESEND_API_KEY=<value>
RESEND_FROM_EMAIL=<value>
EOF
```

**Conditional:** only include the GitHub block if `toggles["oauth.github"] == true`; only Google if `toggles["oauth.google"] == true`; only Resend pair if `toggles["resend"] == true`. (`.dev.vars.example` was already pruned by the subtraction phase to match.)

After writing, remind the user:
> Wrangler reads `.dev.vars` only at dev-server startup. If you change values later, restart `pnpm dev`.

---

## Production secrets — generated, NOT pushed during the interview

Production secrets are pushed via `wrangler secret put` only after the user has deployed and confirmed the prod URL. The skill does NOT push them during Phase 5. Instead, in Apply Step 7 the skill generates a helper script:

`scripts/deploy-secrets.sh`:

```bash
#!/usr/bin/env bash
# Push all .dev.vars values as Cloudflare Worker production secrets.
# Run this ONCE before your first `wrangler deploy`. Re-run any time .dev.vars changes.
set -euo pipefail

if [[ ! -f .dev.vars ]]; then
  echo "Error: .dev.vars not found. This script must run from the project root." >&2
  exit 1
fi

# Read each KEY=VALUE line, skip blank lines and comments, push as a secret.
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  [[ -z "$value" ]] && { echo "Skipping empty key: $key"; continue; }
  echo "Pushing $key…"
  printf '%s' "$value" | wrangler secret put "$key"
done < .dev.vars

# Special case: BETTER_AUTH_URL must equal the deployed Worker URL.
# If you've deployed at least once, override here:
#   BETTER_AUTH_URL=https://<your-worker>.workers.dev wrangler secret put BETTER_AUTH_URL
echo
echo "Done. Reminder: BETTER_AUTH_URL above is set to the localhost dev value."
echo "After your first deploy, override with the production URL:"
echo "  echo 'https://<your-worker>.workers.dev' | wrangler secret put BETTER_AUTH_URL"
```

Make it executable: `chmod +x scripts/deploy-secrets.sh`.

The skill writes this file in Apply Step 7. The skill does NOT run it.

## Two-phase deploy reminder

In the closing message after the skill completes, remind the user about the two-phase deploy (from `BUILD_NOTES.md` Task 13):

1. `pnpm build` produces `dist/` using the localhost `BETTER_AUTH_URL` baked into the SSR bundle.
2. `wrangler deploy` — outputs the production `<slug>.<subdomain>.workers.dev` URL.
3. `echo "https://<that-url>" | wrangler secret put BETTER_AUTH_URL` — overrides the production secret.
4. `VITE_BETTER_AUTH_URL="https://<that-url>" pnpm build && wrangler deploy` — rebuilds the SSR bundle with the prod URL baked in, then redeploys.

(Steps 3–4 are mandatory once; subsequent deploys can use a single `wrangler deploy` because the secret and the build env var are now correct.)
````

- [ ] **Step 2: Verify**

```bash
head -40 .claude/skills/quickstart-setup/credentials.md
grep -c "^## " .claude/skills/quickstart-setup/credentials.md
```

Expected: ~7 top-level headings.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/credentials.md
git commit -m "feat(stage3): write credentials.md (OAuth + Resend walkthroughs + deploy-secrets.sh template)"
```

---

## Task 9: scaffold-feature.md — first-feature rules

**Files:**
- Modify: `.claude/skills/quickstart-setup/scaffold-feature.md`

This is the only generative phase. The skill plans a minimal scaffold from `FEATURE_DESCRIPTION`, shows the plan to the user for confirmation, then writes the files.

- [ ] **Step 1: Write scaffold-feature.md**

Replace the stub with this exact content:

````markdown
# quickstart-setup — Apply Step 6: First-feature scaffold

This is the only **generative** phase of the skill. Everything else is mechanical transformation. The goal is a minimal, working scaffold that demonstrates every layer (D1 + server function + route + component) so the user has a template to grow from — not a polished feature.

**Inputs:**
- `FEATURE_DESCRIPTION` (1–2 sentences from Phase 3, Q11)
- `toggles` (to know whether `org` is on — affects schema)
- `PROJECT_NAME`, `PROJECT_SLUG` (for any user-visible labels)

**Outputs:** four files (or three, if `tests` is off and the user opts out of a test stub):
1. One Drizzle table at `src/db/schema.ts` (replacing the placeholder `notes` table)
2. One server-function module at `src/server/<feature>-actions.ts`
3. One route at `src/routes/dashboard/<feature>.tsx`
4. One component at `src/components/<feature>-list.tsx`

## Step 1 — Plan the scaffold

Read `FEATURE_DESCRIPTION` and decide:

1. **Feature name slug** (kebab-case, used in file paths and route URL). Default: derive from the description's primary noun (e.g., "a notes app with shared workspaces" → `notes`; "habit tracker with daily check-ins" → `habits`). Single-word noun preferred.

2. **Table shape.** Pick a minimal column set:
   - `id` (text PK, generated via crypto.randomUUID)
   - `user_id` (text, FK to `users.id`) — always present
   - `organization_id` (text, FK to `organizations.id`, nullable) — **only if `toggles["org"] == true`**
   - 1–3 domain columns inferred from the description. Examples:
     - "notes app" → `title text not null`, `body text not null default ''`
     - "habit tracker" → `name text not null`, `frequency text not null default 'daily'`, `streak integer not null default 0`
     - "shared task list" → `title text not null`, `done integer not null default 0` (booleans are integers in SQLite)
   - `created_at` (integer, unixepoch, not null)
   - `updated_at` (integer, unixepoch, not null)

3. **Server-function operations.** Default to four CRUD functions:
   - `list<Plural>()` — returns all rows for the current user (and active org if `org` is on)
   - `create<Singular>(input)` — inserts a row
   - `update<Singular>(id, input)` — updates a row owned by the user
   - `delete<Singular>(id)` — deletes a row owned by the user

   Each calls `auth.api.getSession({ headers })` and gates by `session.user.id`; returns `null` / throws on unauth.

4. **Route shape.** A single `/dashboard/<feature>` route that lists items + a simple inline create form. No edit/delete UI in the scaffold — keep it small.

5. **Component shape.** A `<<Feature>List />` client component that calls the list server-fn on mount and renders rows in a basic shadcn `<Card>`. Uses `react-hook-form` for the create form (already in the template's deps).

## Step 2 — Show the plan to the user

Print:

```
Planned scaffold for "<FEATURE_DESCRIPTION>":

  Feature slug: <feature>

  Files to create:
    src/db/schema.ts                 — replace `notes` table with `<plural>` table
    src/server/<feature>-actions.ts  — list/create/update/delete server functions
    src/routes/dashboard/<feature>.tsx — list page at /dashboard/<feature>
    src/components/<feature>-list.tsx — list+create-form component

  Schema:
    <columns and types>

  Operations:
    list<Plural>(), create<Singular>({ ... }), update<Singular>(id, ...), delete<Singular>(id)

Looks good? (yes / no / change <thing>)
```

- On `yes`, proceed to Step 3.
- On `no`, ask: "What would you like to change? (e.g., 'use 5 columns', 'rename feature to X', 'just a list, no create form')". Re-plan and re-show.
- On `change <thing>`, apply the requested change and re-show.

## Step 3 — Remove the placeholder `notes` table

Edit `src/db/schema.ts` to remove the `notes` table definition. Open the file: it currently re-exports `auth-schema.ts` and defines `notes`. Replace the `notes` block with the new feature table.

(Note: the reference's `notes` table is in `src/db/schema.ts` as a sibling of the auth-schema re-export. The Files Inventory in `reference/BUILD_NOTES.md` line 1109 confirms this is the placeholder to remove.)

## Step 4 — Write the four files

Use these templates. Substitute `<feature>` (kebab), `<Feature>` (PascalCase singular), `<Plural>` (PascalCase plural), `<feature_plural>` (snake_case plural for the table name), and any user-customized columns.

### Template: `src/db/schema.ts` (full file replacement)

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

export const <feature_plural> = sqliteTable("<feature_plural>", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  // #if-org organizationId: text("organization_id"),
  // <domain columns from plan>
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

(The `// #if-org` line is **not** a quickstart region marker — it's a placeholder you uncomment based on `toggles.org`. Delete the comment prefix if `org` is on; delete the whole line if off.)

### Template: `src/server/<feature>-actions.ts`

```typescript
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { eq, and, desc } from "drizzle-orm";
import { createDb } from "@/db/client";
import { <feature_plural> } from "@/db/schema";
import { createAuth } from "@/lib/auth/server";

async function requireSession() {
  const cookie = getRequestHeader("cookie") ?? "";
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export const list<Plural> = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const db = createDb(env.DB);
  return await db.select().from(<feature_plural>)
    .where(eq(<feature_plural>.userId, session.user.id))
    .orderBy(desc(<feature_plural>.createdAt));
});

export const create<Singular> = createServerFn({ method: "POST" })
  .validator((input: { /* fields */ }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const db = createDb(env.DB);
    const now = new Date();
    const row = { id: crypto.randomUUID(), userId: session.user.id, ...data, createdAt: now, updatedAt: now };
    await db.insert(<feature_plural>).values(row);
    return row;
  });

export const update<Singular> = createServerFn({ method: "POST" })
  .validator((input: { id: string; /* updatable fields */ }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const db = createDb(env.DB);
    const { id, ...patch } = data;
    await db.update(<feature_plural>).set({ ...patch, updatedAt: new Date() })
      .where(and(eq(<feature_plural>.id, id), eq(<feature_plural>.userId, session.user.id)));
  });

export const delete<Singular> = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const db = createDb(env.DB);
    await db.delete(<feature_plural>)
      .where(and(eq(<feature_plural>.id, data.id), eq(<feature_plural>.userId, session.user.id)));
  });
```

### Template: `src/routes/dashboard/<feature>.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { <Feature>List } from "@/components/<feature>-list";

export const Route = createFileRoute("/dashboard/<feature>")({
  component: <Feature>Page,
});

function <Feature>Page() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="text-2xl font-semibold mb-4"><Plural></h1>
      <<Feature>List />
    </div>
  );
}
```

### Template: `src/components/<feature>-list.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { list<Plural>, create<Singular> } from "@/server/<feature>-actions";

type <Feature> = Awaited<ReturnType<typeof list<Plural>>>[number];

export function <Feature>List() {
  const [items, setItems] = useState<<Feature>[]>([]);
  const { register, handleSubmit, reset } = useForm<{ /* form fields */ }>();

  useEffect(() => { list<Plural>().then(setItems); }, []);

  const onSubmit = async (data: { /* form fields */ }) => {
    const created = await create<Singular>({ data });
    setItems((prev) => [created, ...prev]);
    reset();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
        {/* per-column inputs from plan */}
        <Button type="submit">Add</Button>
      </form>
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              {/* render columns */}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

## Step 5 — Add a dashboard nav link

Edit `src/routes/dashboard/route.tsx` to add a link to the new feature in the dashboard header. The exact location depends on whether `org` is on (the org switcher uses the same header row):

```tsx
<Link to="/dashboard/<feature>" className="text-sm hover:underline"><Plural></Link>
```

Place it after the brand link, before the org switcher / theme toggle.

## Step 6 — Migration regen happens later

The new schema gets a migration in Apply Step 5 (`pnpm db:generate`), which runs **after** auth-schema regen and **after** the `notes` table has been removed. Do not run `pnpm db:generate` here.

## Out-of-scope for the scaffold

Things the scaffold deliberately does NOT do (the user adds these later, hand-coded):
- Edit / delete UI per row (only list + create are in the template)
- Optimistic updates (the list refetches on mount only)
- Validation beyond Zod-via-`.validator` (no field-length, no XSS sanitization beyond what react escapes)
- Pagination
- Sharing / permissions UI (org membership is enforced in the server function but no UI exposes it)
- Tests for the new feature (deferred — the user can copy `tests/auth.test.ts` as a starting point if `vitest` is on)

## Failure modes

| Symptom | Cause | Recovery |
|---|---|---|
| `pnpm exec tsc --noEmit` fails after scaffold | template substitutions left a `<feature>` placeholder | Re-grep for `<feature>`, `<Feature>`, `<Plural>` and resolve any unsubstituted ones. |
| User says "no, just give me a notes app" | scaffold landed on something they don't want | Repeat Step 2 with the user-supplied feature description. |
````

- [ ] **Step 2: Verify**

```bash
head -40 .claude/skills/quickstart-setup/scaffold-feature.md
grep -c "^## Step" .claude/skills/quickstart-setup/scaffold-feature.md
```

Expected: 6 step headings.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/scaffold-feature.md
git commit -m "feat(stage3): write scaffold-feature.md (first-feature rules)"
```

---

## Task 10: SKILL.md Apply phase — Steps 1–4 (subtraction, sentinels, brand color, schema)

**Files:**
- Modify: `.claude/skills/quickstart-setup/SKILL.md`

Replace the placeholder `[ ... ]` left in Task 1 under "Phase 7 — Apply" with the detailed Apply-phase instructions. This task covers Steps 1–4; Tasks 11 and 12 cover Steps 5–11.

- [ ] **Step 1: Replace the placeholder**

Find the exact placeholder line in SKILL.md (`[The detailed Apply-phase steps are filled in by Tasks 10–12 below — leave the section here as a placeholder pointing at "see Apply-phase substeps" until those tasks fill it in.]`) and replace it with the section below. Use the `Edit` tool with `old_string` matching that placeholder line and `new_string` containing:

````markdown
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
````

- [ ] **Step 2: Verify the placeholder is gone and the new content is in place**

```bash
grep -c "Apply-phase substeps" .claude/skills/quickstart-setup/SKILL.md
grep -c "^### Apply Step " .claude/skills/quickstart-setup/SKILL.md
```

Expected: 0 placeholder mentions; 4 Apply Step headings (1, 2, 3, 4).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/SKILL.md
git commit -m "feat(stage3): SKILL.md Apply Steps 1-4 (subtract, sentinels, brand, schema)"
```

---

## Task 11: SKILL.md Apply phase — Steps 5–7 (migrations, types, scaffold, build verification)

**Files:**
- Modify: `.claude/skills/quickstart-setup/SKILL.md`

- [ ] **Step 1: Append Steps 5, 6, 7 to the Apply phase section**

After Apply Step 4 (which ends with a `git commit` block), append:

````markdown

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

### Apply Step 7 — Regenerate worker types + write deploy-secrets.sh + final verification

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

Final at-rest verification:

```bash
pnpm install                    # rebuild lockfile (subtract step removed deps; install consolidates)
pnpm exec tsc --noEmit          # full typecheck against the post-substitution tree
pnpm build                      # vite build — should now succeed because wrangler.jsonc is valid
```

If `vitest` is on:
```bash
pnpm test                       # 6 tests pass (or fewer, if `do`/`org` toggles dropped tests)
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
````

- [ ] **Step 2: Verify**

```bash
grep -c "^### Apply Step " .claude/skills/quickstart-setup/SKILL.md
```

Expected: 7 (Steps 1–7 now exist; the 5a/5b sub-steps are within "Apply Step 5").

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/SKILL.md
git commit -m "feat(stage3): SKILL.md Apply Steps 5-7 (migrations, scaffold, types, verify)"
```

---

## Task 12: SKILL.md Apply phase — Steps 8–11 (git, GitHub, superpowers, self-removal)

**Files:**
- Modify: `.claude/skills/quickstart-setup/SKILL.md`

- [ ] **Step 1: Append Steps 8, 9, 10, 11 to the Apply phase**

After Apply Step 7's commit block, append:

````markdown

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
````

- [ ] **Step 2: Verify**

```bash
grep -c "^### Apply Step " .claude/skills/quickstart-setup/SKILL.md
```

Expected: 11 (Steps 1–11; 5a/5b are sub-bullets inside Step 5).

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/quickstart-setup/SKILL.md
git commit -m "feat(stage3): SKILL.md Apply Steps 8-11 (git, GitHub, superpowers, self-remove)"
```

---

## Task 13: End-to-end test 1 — all-features-on toggle combination

**Files:**
- Test scratch dir: `/tmp/quickstart-e2e-allon-<timestamp>/`

This task validates the skill against a fresh clone with EVERY toggle on. The test is run by hand by the agent executing this plan — there is no test harness; the verification is "did `pnpm build`, `pnpm test`, and `wrangler deploy` all succeed against the output project."

- [ ] **Step 1: Set up scratch dir + fresh clone**

```bash
TS=$(date +%s)
SCRATCH=/tmp/quickstart-e2e-allon-$TS
mkdir -p "$SCRATCH"
# Clone from the local template — simulates `install.sh` output without needing GitHub.
git clone /Users/jamescary/dev/quickstart-template "$SCRATCH"
cd "$SCRATCH"
pnpm install
# Re-init git as install.sh does
rm -rf .git && git init -q && git add -A && git commit -q -m "chore: initial commit from quickstart-template"
```

- [ ] **Step 2: Run the skill**

In a Claude Code session opened at `$SCRATCH`, ask: "run quickstart-setup". Provide answers:

- Q1: `E2E All On`
- Q2: `e2e-all-on`
- Q3: `End-to-end test fixture with every toggle on.`
- Q4: `#0F172A`
- Q5: `GitHub, Google` (both)
- Q6: `y` (org)
- Q7: `y` (resend)
- Q8: `y` (do)
- Q9: `y` (vitest)
- Q10: `n` (Workers Git Integration — skip to avoid creating a GitHub repo)
- Q11: `a notes app with shared workspaces`
- Provider creds: skip all (the test doesn't need real OAuth round-trips)
- Resend: skip
- Phase 6: confirm `yes`

- [ ] **Step 3: Verify the output**

After the skill self-removes, run:

```bash
cd "$SCRATCH"

# Skill removed itself
test ! -f .quickstart-template && test ! -d .claude/skills/quickstart-setup && echo "skill removed: OK"

# Sentinels gone
! grep -rEn '__PROJECT_(NAME|SLUG|DESCRIPTION)__|__BRAND_COLOR__' \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.wrangler . \
  && echo "sentinels gone: OK"

# Build passes
pnpm exec tsc --noEmit && echo "typecheck: OK"
pnpm build && echo "build: OK"
pnpm test && echo "test: OK"

# Deploy (creates real Cloudflare resources — skip if testing locally is the goal)
# wrangler deploy
```

- [ ] **Step 4: Capture findings in STAGE3_NOTES.md**

Append to `STAGE3_NOTES.md` in the main repo (NOT in `$SCRATCH`):

```
## E2E test 1 — all-features-on (e2e-all-on)
- Build: <pass / fail with reason>
- Test: <pass / fail with reason>
- Deploy: <pass / fail / skipped>
- Issues: <any unexpected behavior>
- Cleanup commands run: wrangler d1 delete e2e-all-on-db; wrangler kv namespace delete --namespace-id <KV_ID>
```

- [ ] **Step 5: Cleanup the test resources**

```bash
wrangler d1 delete e2e-all-on-db --skip-confirmation 2>/dev/null
# KV namespace ID was captured during the run — delete it:
wrangler kv namespace delete --namespace-id <captured-KV_ID>
rm -rf "$SCRATCH"
```

- [ ] **Step 6: Commit notes**

```bash
cd /Users/jamescary/dev/quickstart-template
git add STAGE3_NOTES.md
git commit -m "test(stage3): E2E test 1 — all-features-on result"
```

---

## Task 14: End-to-end test 2 — minimal toggles (no OAuth, no org, no resend, no do, no vitest)

**Files:**
- Test scratch dir: `/tmp/quickstart-e2e-minimal-<timestamp>/`

Validates the skill in the opposite extreme: no opt-ins. This exercises the both-OAuth-off combinatorial cleanup AND the absence of every conditional file.

- [ ] **Step 1: Set up scratch dir + fresh clone**

```bash
TS=$(date +%s)
SCRATCH=/tmp/quickstart-e2e-minimal-$TS
mkdir -p "$SCRATCH"
git clone /Users/jamescary/dev/quickstart-template "$SCRATCH"
cd "$SCRATCH"
pnpm install
rm -rf .git && git init -q && git add -A && git commit -q -m "chore: initial commit from quickstart-template"
```

- [ ] **Step 2: Run the skill with minimal answers**

In a Claude Code session at `$SCRATCH`:

- Q1: `E2E Minimal`
- Q2: `e2e-minimal`
- Q3: `End-to-end test with all opt-ins off.`
- Q4: (Enter for default)
- Q5: `none`
- Q6: `n`
- Q7: `n`
- Q8: `n`
- Q9: `n`
- Q10: `n`
- Q11: `a simple counter app`
- All credentials prompts: skip (none should appear since `oauth.*` and `resend` are off)
- Phase 6: confirm `yes`

- [ ] **Step 3: Verify subtraction was complete**

```bash
cd "$SCRATCH"

# OAuth-buttons gone
test ! -f src/components/auth/oauth-buttons.tsx && echo "oauth-buttons.tsx removed: OK"

# `<OAuthButtons />` import gone from login/signup
! grep -E 'OAuthButtons' src/routes/login.tsx src/routes/signup.tsx && echo "OAuthButtons references gone: OK"

# org files gone
test ! -d src/routes/dashboard/org && echo "dashboard/org removed: OK"
test ! -f src/components/org-switcher.tsx && echo "org-switcher.tsx removed: OK"

# resend file gone
test ! -f src/server/email.ts && echo "email.ts removed: OK"

# DO files gone
test ! -f src/server/presence-do.ts && test ! -f src/components/presence-widget.tsx \
  && echo "DO files removed: OK"

# vitest files gone
test ! -d tests && test ! -f vitest.config.ts && echo "vitest removed: OK"

# package.json doesn't list vitest deps
! grep -E '"vitest"|"@cloudflare/vitest-pool-workers"|"resend":' package.json \
  && echo "deps cleaned: OK"

# Build still passes
pnpm install
pnpm exec tsc --noEmit && pnpm build && echo "build: OK"
```

- [ ] **Step 4: Compare against Stage 2 subtraction recipes**

Spot-check `$SCRATCH` against `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md`. For each toggle, every file listed in `delete` is gone, every file listed in `strip` has had its regions removed, every `edit_json` op is reflected in the file. If a discrepancy exists, the skill's manifest or algorithm has a bug — fix and re-run.

- [ ] **Step 5: Cleanup + capture findings**

```bash
wrangler d1 delete e2e-minimal-db --skip-confirmation 2>/dev/null
wrangler kv namespace delete --namespace-id <captured-KV_ID>
rm -rf "$SCRATCH"
```

Append to `STAGE3_NOTES.md`:

```
## E2E test 2 — minimal (e2e-minimal)
- Subtraction completeness: <pass / fail>
- Both-OAuth-off cleanup: <pass / fail>
- Build: <pass / fail>
- Issues: <any unexpected behavior>
```

- [ ] **Step 6: Commit notes**

```bash
cd /Users/jamescary/dev/quickstart-template
git add STAGE3_NOTES.md
git commit -m "test(stage3): E2E test 2 — minimal toggles result"
```

---

## Task 15: End-to-end test 3 — mixed (org+resend on; no DO, no vitest; one OAuth)

**Files:**
- Test scratch dir: `/tmp/quickstart-e2e-mixed-<timestamp>/`

Validates the most common real-world combination AND exercises the `org`+`resend` nested-region case (the `createEmailer` import in `auth/server.ts` lives in nested `org→resend` regions).

- [ ] **Step 1: Set up + run with these answers**

- Q1: `E2E Mixed`
- Q2: `e2e-mixed`
- Q3: `End-to-end test for the typical SaaS combo.`
- Q4: `#3B82F6` (a non-default brand color, exercises the HSL conversion)
- Q5: `GitHub` (only)
- Q6: `y`
- Q7: `y`
- Q8: `n`
- Q9: `y`
- Q10: `n`
- Q11: `a habit tracker with daily check-ins`
- Provider creds: skip
- Resend: skip
- Phase 6: confirm `yes`

- [ ] **Step 2: Verify the nested-region case**

```bash
cd "$SCRATCH"

# auth/server.ts: org block present (org=on); createEmailer import present (both org=on AND resend=on);
# google block absent (oauth.google=off); github block present.
grep -c "organization(" src/lib/auth/server.ts | grep -q '^1$' && echo "org plugin entry: present"
grep -q "createEmailer" src/lib/auth/server.ts && echo "createEmailer import: present"
! grep -q "social.google" src/lib/auth/server.ts && echo "google block: absent"
grep -q "social.github" src/lib/auth/server.ts && echo "github block: present"

# Brand color applied to --primary
grep -q "^  --primary: 217.2 91.2% 59.8%" src/styles.css && echo "brand color HSL: applied"
# (217.2 91.2% 59.8% is the HSL for #3B82F6)

pnpm install
pnpm exec tsc --noEmit && pnpm build && pnpm test && echo "build+test: OK"
```

- [ ] **Step 3: Cleanup + capture findings**

```bash
wrangler d1 delete e2e-mixed-db --skip-confirmation
wrangler kv namespace delete --namespace-id <captured-KV_ID>
rm -rf "$SCRATCH"
```

Append findings to `STAGE3_NOTES.md`.

- [ ] **Step 4: Commit**

```bash
cd /Users/jamescary/dev/quickstart-template
git add STAGE3_NOTES.md
git commit -m "test(stage3): E2E test 3 — mixed toggles result"
```

---

## Task 16: Replace `__GH_USER__` placeholders (publish prep)

**Files:**
- Modify: `install.sh`
- Modify: `install.md`
- Modify: `.claude/skills/quickstart-setup/TEMPLATE_URL`

The placeholder `__GH_USER__` exists in three places. To make `install.sh` actually clone (and `TEMPLATE_URL` actually resolve), the user must commit a real GitHub repo URL.

- [ ] **Step 1: Confirm the GitHub repo destination with the user**

Ask the user (the human running this plan, not a future skill user):
> What GitHub user/org will host the published `quickstart-template` repo? (e.g., `videojames`, `eliteeggnog`, `your-org-name`)

Capture the answer as `GH_USER`.

- [ ] **Step 2: Substitute `__GH_USER__` in all three files**

```bash
GH_USER='<answer>'

sed -i '' "s|__GH_USER__|${GH_USER}|g" install.sh
sed -i '' "s|__GH_USER__|${GH_USER}|g" install.md
sed -i '' "s|__GH_USER__|${GH_USER}|g" .claude/skills/quickstart-setup/TEMPLATE_URL

# Verify no placeholders remain
! grep -rE '__GH_USER__' install.sh install.md .claude/skills/quickstart-setup/TEMPLATE_URL \
  && echo "GH_USER substituted: OK"
```

- [ ] **Step 3: Commit**

```bash
git add install.sh install.md .claude/skills/quickstart-setup/TEMPLATE_URL
git commit -m "chore(stage3): substitute __GH_USER__ for publish"
```

---

## Task 17: Update STATUS.md and finalize

**Files:**
- Modify: `STATUS.md`

- [ ] **Step 1: Update Stage progress + Stage 3 details**

Edit `STATUS.md`:
- Change the Stage 3 row in the progress table from `⏳ Pending` to `✅ Done (2026-MM-DD)` (today's date) and update its "Output" column with: `.claude/skills/quickstart-setup/ — SKILL.md, manifest.json, interview/cloudflare/credentials/scaffold-feature, TEMPLATE_URL. Plan: docs/superpowers/plans/2026-05-01-stage3-build-skill.md. Validated via 3 E2E test combinations (see STAGE3_NOTES → folded into this file).`
- In "Where things live", add the `.claude/skills/quickstart-setup/` directory to the listing.
- Add a new section "Stage 3 known limitations / things deferred" with:
  - Workers Git Integration's last step (connect repo in Cloudflare dashboard) is manual — there is no fully-automated API as of 2026-05-01.
  - Programmatic superpowers install via `.claude/settings.json` may not work in all Claude Code versions; print fallback covers this.
  - The skill assumes `gh` CLI is authenticated for the GitHub repo create path; absent → manual instructions.
  - First-feature scaffold is intentionally minimal (list + create only); edit/delete UI is left for the user.
- Replace the "To pick up where we left off" section with a line saying Stage 3 is done; the template is ready to publish.

Refer to existing STATUS.md formatting; keep the same headings + table style.

- [ ] **Step 2: Fold STAGE3_NOTES.md content into STATUS.md, then delete the scratch file**

```bash
# After folding any actionable findings from STAGE3_NOTES.md into STATUS.md:
rm STAGE3_NOTES.md
```

- [ ] **Step 3: Final verification — does the template still typecheck at-rest?**

```bash
pnpm exec tsc --noEmit
```

(The template-at-rest still has sentinels because Stage 3 BUILT the skill — it didn't run it on the template itself. typecheck is the floor; build/test require sentinel substitution.)

- [ ] **Step 4: Commit**

```bash
git add STATUS.md
git commit -m "docs: Stage 3 complete; quickstart-setup skill ready to ship"
```

- [ ] **Step 5: Tag the release (optional but recommended)**

```bash
git tag -a v0.1.0 -m "First publishable release of quickstart-template"
```

(No push — the user will push when they're ready.)

---

## Self-review checklist

Before marking this plan complete, run through:

- [ ] Spec coverage: every numbered phase in the spec's "Interview flow" maps to a task here.
- [ ] Manifest entries match `docs/superpowers/specs/2026-05-01-stage2-subtraction-recipes.md` 1:1.
- [ ] Apply phase order is consistent with `cloudflare.md`'s deferral notes (Phase 4 writes IDs but doesn't validate; Apply Step 5 + 7 do).
- [ ] No placeholders (`TODO`, `TBD`, "implement later") remain in any task.
- [ ] Every shell snippet uses real, runnable commands — no pseudo-shell.
- [ ] Sentinel list (4 sentinels) and toggle list (6 toggles) match across all files.
- [ ] E2E tests cover: all-on, all-off-with-both-OAuth-cleanup, and a mixed real-world combo.
