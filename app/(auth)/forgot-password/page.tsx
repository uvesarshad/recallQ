import { Mail } from "lucide-react";

import { requestPasswordReset } from "../actions";
import { AuthFooterLink, AuthMessage, AuthPage, inputClassName } from "../auth-ui";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const sent = params?.status === "sent";

  return (
    <AuthPage eyebrow="Password help" title="Reset your password" subtitle="Enter your email and we will send a secure reset link if the account exists.">
      {sent ? (
        <AuthMessage tone="success">
          If that email exists, a reset link has been sent. In local development, check the terminal for the link.
        </AuthMessage>
      ) : null}

      <form action={requestPasswordReset} className="space-y-4">
        <input
          id="reset-email"
          name="email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          required
          className={inputClassName}
        />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-buttons bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          <Mail className="h-4 w-4" />
          Send reset link
        </button>
      </form>

      <p className="text-center text-xs text-text-muted">
        Remembered it? <AuthFooterLink href="/login">Sign in</AuthFooterLink>
      </p>
    </AuthPage>
  );
}
