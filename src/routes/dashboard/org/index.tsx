import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/dashboard/org/")({
  component: OrgPage,
});

function OrgPage() {
  // useActiveOrganization is generated from the activeOrganization atom.
  // It already includes { members: Member[], invitations: Invitation[] }.
  const { data: active } = authClient.useActiveOrganization();

  if (!active) {
    return (
      <p className="text-muted-foreground">
        No organization selected. Use the switcher in the header to select or
        create one.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{active.name}</h2>
        <Link to="/dashboard/org/invite">
          <Button size="sm">Invite member</Button>
        </Link>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Members ({active.members?.length ?? 0})
        </h3>
        {active.members?.length ? (
          <ul className="divide-y border rounded-md">
            {active.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <span className="font-medium">
                  {/* userId is available; email is on the user object, not member */}
                  {(m as { user?: { email?: string; name?: string } }).user
                    ?.email ??
                    (m as { user?: { name?: string } }).user?.name ??
                    m.userId}
                </span>
                <span className="text-muted-foreground capitalize">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No members found.</p>
        )}
      </div>
    </div>
  );
}
