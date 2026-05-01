# quickstart-setup — Phase 4: Cloudflare provisioning

This phase creates the D1 database and KV namespace, writes their IDs into `wrangler.jsonc`, applies initial migrations to local D1, and regenerates `worker-configuration.d.ts`. **No questions to the user except picking an account if `wrangler whoami` returns multiple.**

## Prerequisites check

```bash
wrangler --version
```

Expected: a version string. If `wrangler` is not installed, abort with: "Wrangler is required. Install with `pnpm add -D wrangler` or `npm i -g wrangler` and re-run."

## Step 0 — Pre-substitute the worker slug in `wrangler.jsonc`

**Why this step exists:** Wrangler ≥4.x parses and validates the local `wrangler.jsonc` for *every* command, including global ones like `wrangler whoami`, `wrangler d1 list`, and `wrangler kv namespace list`. The template ships with `name: "__PROJECT_SLUG__"` and `database_name: "__PROJECT_SLUG__-db"`, both of which fail wrangler's `name` validation (`Expected "name" to be of type string, alphanumeric and lowercase with dashes only`). Until the slug sentinel is replaced, every wrangler command will error before doing anything useful.

The full sentinel substitution lives in Apply Step 2 (after Phase 6 confirmation), but we need a valid slug NOW. We already have the user's chosen `PROJECT_SLUG` from Phase 1 Q2 — substitute just that one sentinel:

```bash
sed -i '' \
  -e "s|__PROJECT_SLUG__|<PROJECT_SLUG>|g" \
  wrangler.jsonc
```

Verify:
```bash
! grep -q '__PROJECT_SLUG__' wrangler.jsonc && echo "slug pre-substituted: OK"
```

**Idempotency:** Apply Step 2's global sentinel pass will also process `wrangler.jsonc`, but its `__PROJECT_SLUG__` regex won't match anymore (already replaced) — that's a no-op, which is the desired behavior.

**Abort/rollback note:** if the user aborts at Phase 6, `wrangler.jsonc` has been mutated (slug substitution + D1 ID + KV ID writes from Steps 2–3 below). The abort message in `interview.md` § Phase 6 should remind the user they can `git checkout -- wrangler.jsonc` to restore it.

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

## Step 4 — Smoke-test the D1 connection

The skill regenerates `drizzle/migrations/` later (in the Apply phase, after `auth-schema.ts` regeneration and the feature scaffold). At this Phase 4 stage, just verify wrangler can talk to the new D1:

```bash
wrangler d1 execute <PROJECT_SLUG>-db --local --command "SELECT 1 AS ok"
```

Expected: `[{ "ok": 1 }]`. (Step 0's slug pre-substitution makes this validation-clean; the actual `wrangler d1 migrations apply` happens in Apply Step 5b after the migration is regenerated.)

## Step 5 — Worker-types regeneration (DEFERRED to Apply phase)

`worker-configuration.d.ts` must reflect the post-subtraction `wrangler.jsonc` (e.g., absence of `PRESENCE` binding when `do` is off). Subtraction runs in Apply Step 1, so the wrangler-types regen runs in Apply Step 7 after subtraction completes.

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
