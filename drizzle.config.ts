import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  // No `driver` set — pnpm db:generate doesn't need one. If you want
  // drizzle-kit push/studio later, uncomment below and set credentials in .dev.vars.
  // driver: "d1-http",
  // dbCredentials: {
  //   accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  //   databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
  //   token: process.env.CLOUDFLARE_D1_TOKEN!,
  // },
});
