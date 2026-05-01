import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/lib/auth/client";
// #region quickstart:if=do
import { PresenceWidget } from "@/components/presence-widget";
// #endregion

export const Route = createFileRoute("/dashboard/")({ component: DashboardHome });

function DashboardHome() {
  const { data: session, isPending } = useSession();
  if (isPending || !session) return <p>Loading...</p>;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Welcome, {session?.user.name}</h2>
        <p className="text-muted-foreground">{session?.user.email}</p>
      </div>
      {/* #region quickstart:if=do */}
      <PresenceWidget />
      {/* #endregion */}
    </div>
  );
}
