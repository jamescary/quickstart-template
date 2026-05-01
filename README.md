# __PROJECT_NAME__

__PROJECT_DESCRIPTION__

Built from [quickstart-template](https://github.com/__GH_USER__/quickstart-template) — a Cloudflare-native full-stack starter using TanStack Start, Drizzle, D1, KV, Durable Objects, better-auth, and Resend.

## Quickstart

This project was scaffolded by the `quickstart-setup` skill. Cloudflare resources, OAuth credentials, and an example feature have already been wired up. To start developing:

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then fill in BETTER_AUTH_SECRET (openssl rand -base64 32) and any OAuth/Resend keys
pnpm db:migrate:local             # apply Drizzle migrations to local D1
pnpm dev                          # http://localhost:3000
```

## Stack

- **Frontend + server:** TanStack Start (React, file-based routing, server functions)
- **Hosting:** Cloudflare Workers via `@cloudflare/vite-plugin`
- **Database:** Cloudflare D1 + Drizzle ORM
- **KV:** Cloudflare Workers KV (used by better-auth for rate limiting + cache)
- **Realtime:** Cloudflare Durable Objects (presence widget — included if you opted in)
- **Auth:** better-auth + `better-auth-cloudflare`
- **Email:** Resend (with dev-mode console fallback) — included if you opted in
- **UI:** Tailwind v4 + shadcn/ui (`new-york`)
- **Tests:** Vitest + `@cloudflare/vitest-pool-workers` — included if you opted in
- **Package manager:** pnpm

## Test

```bash
pnpm test
```

Tests run against the real Cloudflare runtime via miniflare (D1, KV, Durable Objects all bind in tests).

## Deploy

```bash
wrangler login                    # one-time
./scripts/deploy-secrets.sh       # pushes .dev.vars values as production secrets (one-time)
pnpm db:migrate:remote            # push schema to production D1
pnpm build
wrangler deploy
```

## Background

This project is built from a template that ships every supported feature wired up; the setup skill subtracted features you opted out of and scaffolded a starter feature based on your description.

See [the template repo](https://github.com/__GH_USER__/quickstart-template) for source and updates.
