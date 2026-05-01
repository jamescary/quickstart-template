import { createAuthClient } from "better-auth/react";
// #region quickstart:if=org
import { organizationClient } from "better-auth/client/plugins";
// #endregion

export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? (import.meta.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000")
      : window.location.origin,
  plugins: [
    // #region quickstart:if=org
    organizationClient(),
    // #endregion
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
