import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? (import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000")
      : window.location.origin,
  plugins: [organizationClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
