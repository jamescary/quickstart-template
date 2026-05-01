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
- "GitHub Client ID? (or type `skip` to leave empty)" → capture `GITHUB_CLIENT_ID` (empty if user typed `skip`).
- "GitHub Client Secret? (or type `skip` to leave empty)" → capture `GITHUB_CLIENT_SECRET`.

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
- "Google Client ID? (or type `skip` to leave empty)" → `GOOGLE_CLIENT_ID`.
- "Google Client Secret? (or type `skip` to leave empty)" → `GOOGLE_CLIENT_SECRET`.

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
- "Resend API key? (or type `skip` to leave empty)" → `RESEND_API_KEY`.
- "Resend FROM email? Type `default` for `onboarding@resend.dev` or enter a different address." → `RESEND_FROM_EMAIL`.

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
