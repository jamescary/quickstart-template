import type {
  D1Database,
  KVNamespace,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";
import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { organization } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { createEmailer } from "@/server/email";

export interface AuthEnv {
  DB: D1Database;
  KV: KVNamespace;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export function createAuth(
  env?: AuthEnv,
  cf?: IncomingRequestCfProperties,
  baseURL?: string,
) {
  const db = env ? drizzle(env.DB, { schema, logger: false }) : ({} as any);

  const social: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET) {
    social.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    };
  }
  if (env?.GOOGLE_CLIENT_ID && env?.GOOGLE_CLIENT_SECRET) {
    social.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  return betterAuth({
    secret: env?.BETTER_AUTH_SECRET,
    baseURL: baseURL ?? env?.BETTER_AUTH_URL,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: (cf ?? {}) as any,
        d1: env
          ? { db, options: { usePlural: true, debugLogs: false } }
          : undefined,
        kv: env?.KV,
      },
      {
        emailAndPassword: { enabled: true },
        socialProviders: social,
        plugins: [
          organization({
            organizationHooks: {
              afterCreateInvitation: async ({ invitation, organization, inviter }) => {
                if (!env) return; // CLI/no-runtime-env path; nothing to send
                const emailer = createEmailer(env);
                const acceptUrl = `${env.BETTER_AUTH_URL}/accept-invitation/${invitation.id}`;
                await emailer.send({
                  to: invitation.email,
                  subject: `${inviter.name ?? "Someone"} invited you to ${organization.name}`,
                  html: `
                    <div style="font-family: system-ui, sans-serif; line-height: 1.5;">
                      <h2>You're invited to ${organization.name}</h2>
                      <p>${inviter.name ?? "A team member"} invited you to join <strong>${organization.name}</strong>.</p>
                      <p><a href="${acceptUrl}" style="display: inline-block; padding: 10px 16px; background: #0F172A; color: white; text-decoration: none; border-radius: 6px;">Accept invitation</a></p>
                      <p style="color: #666; font-size: 14px;">If the button doesn't work, copy this link: ${acceptUrl}</p>
                    </div>
                  `,
                });
              },
            },
          }),
        ],
        rateLimit: {
          enabled: true,
          window: 60,
          max: 100,
          customRules: {
            "/sign-in/email": { window: 60, max: 100 },
            "/sign-in/social": { window: 60, max: 100 },
          },
        },
      },
    ),
    // CLI schema generation only — no env present
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as D1Database, {
            provider: "sqlite",
            usePlural: true,
          }),
        }),
  });
}

// Exported for the better-auth CLI generator to pick up
export const auth = createAuth();
