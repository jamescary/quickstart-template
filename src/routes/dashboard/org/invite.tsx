import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/dashboard/org/invite")({
  component: InvitePage,
});

function InvitePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await authClient.organization.inviteMember({
        email,
        role: "member",
      });
      if (result.error) {
        setError(result.error.message ?? "Invite failed");
        return;
      }
      navigate({ to: "/dashboard/org" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Invite member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Sending..." : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
