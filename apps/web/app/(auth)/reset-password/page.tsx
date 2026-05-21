import PasswordField from "@/components/PasswordField";
import { KeyRound } from "lucide-react";

import { resetPassword } from "../actions";
import { AuthFooterLink, AuthMessage, AuthPage } from "../auth-ui";

export const dynamic = "force-dynamic";

function getResetErrorMessage(error?: string) {
  if (!error) return null;
  if (error === "InvalidToken") return "This reset link is invalid or has expired.";
  if (error === "PasswordMismatch") return "The password fields do not match.";
  if (error === "InvalidPassword") return "Password must be at least 8 characters.";
  return "Unable to reset your password. Try again.";
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token ?? "";
  const errorMessage = getResetErrorMessage(params?.error);

  return (
    <AuthPage eyebrow="Password reset" title="Choose a new password" subtitle="Use at least 8 characters for your new Recall password.">
      {errorMessage ? <AuthMessage>{errorMessage}</AuthMessage> : null}

      {token ? (
        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-2">
            <PasswordField
              id="new-password"
              name="password"
              placeholder="New password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <PasswordField
              id="confirm-password"
              name="confirmPassword"
              placeholder="Confirm password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-buttons bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            <KeyRound className="h-4 w-4" />
            Update password
          </button>
        </form>
      ) : (
        <AuthMessage>This reset link is missing a token. Request a new reset link.</AuthMessage>
      )}

      <p className="text-center text-xs text-text-muted">
        Need another link? <AuthFooterLink href="/forgot-password">Request reset</AuthFooterLink>
      </p>
    </AuthPage>
  );
}
