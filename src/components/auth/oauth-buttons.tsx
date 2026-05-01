import { signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={() => signIn.social({ provider: "github", callbackURL: "/dashboard" })}
      >
        Continue with GitHub
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => signIn.social({ provider: "google", callbackURL: "/dashboard" })}
      >
        Continue with Google
      </Button>
    </div>
  );
}
