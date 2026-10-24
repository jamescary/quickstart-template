import { Resend } from "resend";

export interface EmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export function createEmailer(env: EmailEnv) {
  const dev = !env.RESEND_API_KEY;
  return {
    async send(args: { to: string; subject: string; html: string }) {
      if (dev) {
        console.log("[email:dev]", args);
        return { id: "dev-stub" };
      }
      const resend = new Resend(env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
        to: [args.to],
        subject: args.subject,
        html: args.html,
      });
      if (error) {
        throw new Error(
          `Resend error: ${error.message ?? JSON.stringify(error)}`,
        );
      }
      return data!;
    },
  };
}
