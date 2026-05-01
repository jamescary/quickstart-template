# quickstart-setup interview

This file contains the question scripts for Phases 1, 2, 3, and 6. Phases 4 (Cloudflare) and 5 (Credentials) live in their own files because they are command-driven rather than purely interview-driven.

**Tone:** terse, friendly, agent-style. One question at a time. Default values shown in `[brackets]`; the user typing `default` accepts the default (Claude Code cannot send an empty message, so the user must type some text). For optional credential prompts, the user types `skip` to leave the value empty. Re-prompt on invalid input with a one-line explanation.

---

## Phase 1 — Identity

Ask in this order:

### Q1. Display name
> What's the display name of your project? (e.g., "Notepad", "Acme CRM")

- Required, non-empty, ≤ 60 chars.
- Re-prompt if blank.
- Capture as `PROJECT_NAME`.

### Q2. Project codename / slug
> Project slug for `package.json`, `wrangler.jsonc`, and the deploy URL? Default: `<kebab-case-default>` — type `default` to accept, or enter a different slug.

- Default: lowercase of `PROJECT_NAME`, replace whitespace and `_` with `-`, drop any character not in `[a-z0-9-]`.
- Validation: must match `^[a-z][a-z0-9-]*$` AND be 1–63 chars (Cloudflare worker name rule).
- Re-prompt with: "Slug must be lowercase, start with a letter, and contain only letters, digits, and hyphens."
- Capture as `PROJECT_SLUG`.

### Q3. One-sentence description
> One-sentence description of the project? (Used in `package.json`, README, and the landing page.)

- Required, non-empty.
- Capture as `PROJECT_DESCRIPTION`. The skill will JSON-escape this when writing into `package.json` (escape `"` and `\`).

### Q4. Brand color
> Brand color (hex, e.g., `#0F172A`)? Type `default` for `#0F172A` or enter a six-digit hex.

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
> Use the better-auth organization plugin? Type `y` or `n` (default: `n`). Adds orgs, member roles, invitations.

- Default: `n`. Accept `y/yes/Y/Yes` as true; `n/no/N/No/default` as false.
- Capture as `toggles["org"]`.

### Q7. Resend (transactional email)
> Use Resend for transactional email? Type `y` or `n` (default: `n`). Without it, dev mode logs emails to console. (Note: org-plugin invitation emails depend on this; if `org` is on but `resend` is off, invitations will only show up in console logs locally and won't be sent in production.)

- Default: `n`. Accept `y/yes/Y/Yes` as true; `n/no/N/No/default` as false.
- Capture as `toggles["resend"]`.

### Q8. Durable Object example
> Include the example Durable Object (real-time presence widget on the dashboard)? Type `y` or `n` (default: `n`).

- Default: `n`. Accept `y/yes/Y/Yes` as true; `n/no/N/No/default` as false.
- Capture as `toggles["do"]`.

### Q9. Vitest
> Include vitest setup with example tests against the Cloudflare Workers pool? Type `y` or `n` (default: `y`).

- Default: `y` (recommended for any non-trivial project; re-running `pnpm test` validates the project after every change). Accept `y/yes/Y/Yes/default` as true; `n/no/N/No` as false.
- Capture as `toggles["vitest"]`.

### Q10. Cloudflare Workers Git Integration
> Set up Cloudflare Workers Git Integration for auto-deploy on push? Type `y` or `n` (default: `n`). If yes, the skill will create a GitHub repo via `gh repo create` during Phase 7 and walk you through connecting it. Requires `gh` CLI authenticated; if it's not, the skill will skip and print manual setup steps.

- Default: `n`. Accept `y/yes/Y/Yes` as true; `n/no/N/No/default` as false.
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
