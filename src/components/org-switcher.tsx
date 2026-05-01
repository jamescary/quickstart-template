import { authClient } from "@/lib/auth/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function OrgSwitcher() {
  // useListOrganizations and useActiveOrganization are generated from the
  // organizationClient()'s getAtoms: atom keys get `use` prefixed + capitalized.
  // activeOrganization atom also contains { members: Member[], invitations: Invitation[] }.
  const { data: orgs } = authClient.useListOrganizations();
  const { data: active } = authClient.useActiveOrganization();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setCreating(true);
    setError(null);
    const result = await authClient.organization.create({
      name: name.trim(),
      slug,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error.message ?? "Failed to create organization");
      return;
    }
    setName("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {active?.name ?? "Select organization"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {orgs?.length ? (
            orgs.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onSelect={() =>
                  authClient.organization.setActive({ organizationId: o.id })
                }
              >
                {o.name}
                {active?.id === o.id && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    active
                  </span>
                )}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>No organizations</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DialogTrigger asChild>
            {/* preventDefault on onSelect stops Radix from auto-closing the
                dropdown before the dialog opens — without it the
                DropdownMenuItem's default select behavior dismisses the menu
                and unmounts the DialogTrigger ancestor mid-click. */}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setOpen(true);
              }}
            >
              + Create organization
            </DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={onCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc"
              autoFocus
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
