import PasswordField from "@/components/PasswordField";
import { auth } from "@/lib/auth";
import { UserPlus } from "lucide-react";
import { redirect } from "next/navigation";

import { createPasswordUser } from "../actions";
import { AuthFooterLink, AuthMessage, AuthPage, inputClassName } from "../auth-ui";
import { getSafeRedirectTarget } from "../utils";

export const dynamic = "force-dynamic";

function getSignupErrorMessage(error?: string) {
  if (!error) return null;
  if (error === "AccountExists") return "An account already exists for that email. Sign in instead.";
  if (error === "InvalidPassword") return "Password must be at least 8 characters.";
  return "Unable to create your account. Try again.";
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string; next?: string; error?: string }>;
}) {
  if (process.env.DEV_BYPASS_LOGIN === "true") {
    redirect("/app");
  }

  const session = await auth();
  if (session?.user?.id) {
    redirect("/app");
  }

  const params = await searchParams;
  const redirectTo = getSafeRedirectTarget(params?.callbackUrl ?? params?.next);
  const errorMessage = getSignupErrorMessage(params?.error);
  const loginHref = redirectTo === "/app" ? "/login" : `/login?callbackUrl=${encodeURIComponent(redirectTo)}`;

  return (
    <AuthPage eyebrow="Create account" title="Start using Recall" subtitle="Save anything and make it searchable from one private workspace.">
      {errorMessage ? <AuthMessage>{errorMessage}</AuthMessage> : null}

      <form action={createPasswordUser} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div className="space-y-2">
          <input
            id="signup-name"
            name="name"
            type="text"
            placeholder="Name"
            autoComplete="name"
            className={inputClassName}
          />
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            required
            className={inputClassName}
          />
          <PasswordField
            id="signup-password"
            name="password"
            placeholder="Create password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-buttons bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          <UserPlus className="h-4 w-4" />
          Create account
        </button>
      </form>

      <p className="text-center text-xs text-text-muted">
        Already have an account? <AuthFooterLink href={loginHref}>Sign in</AuthFooterLink>
      </p>
    </AuthPage>
  );
}
