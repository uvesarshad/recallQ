import PasswordField from "@/components/PasswordField";
import { auth } from "@/lib/auth";
import { isAppleSignInConfigured } from "@/lib/apple-secret";
import { env } from "@/lib/env";
import { Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { signInWithApple, signInWithGoogle, signInWithPassword } from "../actions";
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
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const appleEnabled = isAppleSignInConfigured();
  const anyOAuth = googleEnabled || appleEnabled;

  return (
    <AuthPage title="RecallQ" subtitle="Sign in to open your private workspace.">
      {errorMessage ? <AuthMessage>{errorMessage}</AuthMessage> : null}
      {statusMessage ? <AuthMessage tone="success">{statusMessage}</AuthMessage> : null}

      <div className="space-y-4">
        {googleEnabled ? (
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
        ) : null}

        {appleEnabled ? (
          <form action={signInWithApple}>
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-buttons bg-black px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              <svg viewBox="0 0 14 17" width="14" height="17" aria-hidden="true" fill="currentColor">
                <path d="M13.07 13.27c-.23.53-.51 1.02-.83 1.47-.44.62-.8 1.05-1.07 1.29-.43.4-.89.6-1.38.62-.35 0-.78-.1-1.27-.31-.49-.21-.94-.31-1.36-.31-.43 0-.9.1-1.4.31-.5.21-.91.32-1.22.33-.47.02-.94-.19-1.4-.63-.29-.26-.66-.71-1.12-1.34-.49-.69-.89-1.49-1.21-2.4C.27 11.51 0 10.55 0 9.63c0-1.07.23-1.99.69-2.76.36-.62.84-1.11 1.44-1.47.6-.36 1.25-.55 1.95-.56.37 0 .85.11 1.45.34.6.23 1 .35 1.18.35.14 0 .58-.13 1.32-.4.7-.25 1.29-.35 1.78-.31 1.31.1 2.29.62 2.94 1.54-1.17.71-1.74 1.7-1.73 2.97.01 1 .37 1.83 1.08 2.5.32.31.68.55 1.08.72-.09.25-.18.49-.28.72z" />
                <path d="M9.03 1.07c0 .81-.3 1.57-.88 2.27-.71.83-1.56 1.31-2.49 1.24-.01-.1-.02-.21-.02-.31 0-.78.34-1.61.95-2.29.3-.34.69-.62 1.15-.85.46-.22.9-.34 1.31-.36.01.1.02.2.02.3z" />
              </svg>
              Continue with Apple
            </button>
          </form>
        ) : null}

        {anyOAuth ? (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border-soft" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface px-2 text-text-muted">Or email password</span>
            </div>
          </div>
        ) : null}

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
            <span>Use your RecallQ password.</span>
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
        New to RecallQ? <AuthFooterLink href={signupHref}>Create an account</AuthFooterLink>
      </p>
    </AuthPage>
  );
}
