import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { authClient } from "@/lib/auth/client";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { createAuth, type AuthEnv } from "@/lib/auth/server";
import ThemeToggle from "@/components/ThemeToggle";
// #region quickstart:if=org
import { OrgSwitcher } from "@/components/org-switcher";
// #endregion
import { Button } from "@/components/ui/button";

const getSessionServer = createServerFn({ method: "GET" }).handler(async () => {
  // Use the server-side auth directly (avoids HTTP round-trip to self, which fails in Workers)
  const request = getRequest();
  if (!request) return null;
  const auth = createAuth(env as unknown as AuthEnv);
  const session = await auth.api.getSession({ headers: request.headers });
  return session;
});

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const sessionData = await getSessionServer();
    if (!sessionData) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b p-4">
        <Link to="/dashboard" className="font-semibold">
          Quickstart Reference
        </Link>
        <div className="flex items-center gap-2">
          {/* #region quickstart:if=org */}
          <OrgSwitcher />
          {/* #endregion */}
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await authClient.signOut();
              // Hard navigation required: soft navigate() does not re-run beforeLoad,
              // so the router would retain stale authenticated state from the dashboard
              // after authClient.signOut() clears the session cookie.
              window.location.href = "/login";
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
