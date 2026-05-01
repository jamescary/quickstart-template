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
