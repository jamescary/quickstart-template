import { signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2">
      {/* #region quickstart:if=oauth.github */}
      <Button
        type="button"
        variant="outline"
        onClick={() => signIn.social({ provider: "github", callbackURL: "/dashboard" })}
      >
        Continue with GitHub
      </Button>
      {/* #endregion */}
      {/* #region quickstart:if=oauth.google */}
      <Button
        type="button"
        variant="outline"
        onClick={() => signIn.social({ provider: "google", callbackURL: "/dashboard" })}
      >
        Continue with Google
      </Button>
      {/* #endregion */}
    </div>
  );
}
