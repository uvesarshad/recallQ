import PasswordField from "@/components/PasswordField";
import { auth } from "@/lib/auth";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { signInWithGoogle, signInWithPassword } from "../actions";
import { AuthFooterLink, AuthMessage, AuthPage, inputClassName } from "../auth-ui";
import { getSafeRedirectTarget } from "../utils";

export const dynamic = "force-dynamic";

function getLoginErrorMessage(error?: string) {
  if (!error) return null;
  if (error === "CredentialsSignin") return "The email or password is incorrect.";
  return "Unable to complete sign-in. Try again.";
}

function getStatusMessage(status?: string) {
  if (status === "password-reset") return "Password updated. Sign in with your new password.";
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string; callbackUrl?: string; error?: string; status?: string }>;
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
  const errorMessage = getLoginErrorMessage(params?.error);
  const statusMessage = getStatusMessage(params?.status);
  const signupHref = redirectTo === "/app" ? "/signup" : `/signup?callbackUrl=${encodeURIComponent(redirectTo)}`;

  return (
    <AuthPage title="Recall" subtitle="Sign in to open your private workspace.">
      {errorMessage ? <AuthMessage>{errorMessage}</AuthMessage> : null}
      {statusMessage ? <AuthMessage tone="success">{statusMessage}</AuthMessage> : null}

      <div className="space-y-4">
        <form action={signInWithGoogle}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-buttons bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gray-100"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#4285F4] text-[10px] font-bold text-white">
              G
            </span>
            Continue with Google
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border-soft" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-text-muted">Or email password</span>
          </div>
        </div>

        <form action={signInWithPassword} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <input
              id="signin-email"
              name="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              required
              className={inputClassName}
            />
            <PasswordField
              id="signin-password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
              minLength={8}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Use your Recall password.</span>
            <AuthFooterLink href="/forgot-password">Forgot password?</AuthFooterLink>
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-buttons bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <Lock className="h-4 w-4" />
            Sign in
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-text-muted">
        New to Recall? <AuthFooterLink href={signupHref}>Create an account</AuthFooterLink>
      </p>
    </AuthPage>
  );
}
