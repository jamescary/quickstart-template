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
