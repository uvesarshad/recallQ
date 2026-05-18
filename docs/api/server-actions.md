# Server Actions

> Scope: Documents Next.js Server Actions, inline form handlers, validation schemas, and redirect security.
> Rendering context: Server-side
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall uses module-level Next.js Server Actions in app/(auth)/actions.ts to handle secure user authentication from dedicated auth pages. These asynchronous functions are executed on the server in response to form submissions, keeping credentials, token generation, email delivery, and authentication APIs server-isolated.

## Server Actions Catalog

### Google Sign-in Action
- Trigger: Form submission in the primary Google login block in app/(auth)/login/page.tsx.
- Behavior: signInWithGoogle invokes the signIn helper from lib/auth.ts, passing google as the provider.
- Redirect Target: Accepts a secure internal redirect URL string to route the user immediately to their private dashboard after Google OAuth completes.

### Email Password Sign-in Action
- Trigger: Form submission in the Email login section of app/(auth)/login/page.tsx.
- Behavior: signInWithPassword receives the standard HTML FormData object.
- Parameters: Extracts email and password values from the submitted form inputs and triggers the credentials provider via the signIn helper in lib/auth.ts.
- Failure Handling: Catches AuthError failures and redirects back to /login with a safe error code so the page can render a user-facing message.

### Email Password Signup Action
- Trigger: Form submission in app/(auth)/signup/page.tsx.
- Behavior: Validates email and minimum password length server-side, rejects duplicate emails, hashes the password with lib/password.ts, inserts a user row with password_hash, and signs in through the credentials provider.

### Password Reset Request Action
- Trigger: Form submission in app/(auth)/forgot-password/page.tsx.
- Behavior: Normalizes the email address, looks up a matching user if present, creates a hashed one-time reset token in password_reset_tokens, and sends a reset link through Resend when configured. Missing accounts redirect to the same success state to avoid account enumeration.

### Password Reset Completion Action
- Trigger: Form submission in app/(auth)/reset-password/page.tsx.
- Behavior: Validates the token and matching password fields, updates users.password_hash inside a transaction, marks the reset token used, and redirects to /login with a success status.

## Validation and Security Controls
- Open-Redirect Prevention: Redirect paths are processed by the getSafeRedirectTarget utility. It validates that callback URLs start strictly with a single slash (preventing protocol-relative or external domain bypasses) and defaults to /app if a path is invalid or missing.
- Input Validation: HTML-level required inputs, email type constraints, and password length constraints are enforced in the browser before the Server Action is invoked. Server actions repeat critical checks before writing users or invoking signIn.

## Security Constraints
- AGENT AVOID: Never import or execute NextAuth signIn hooks on the client. Auth providers must strictly be invoked inside server-side environments or Server Actions.
- AGENT NOTE: Always sanitise user-supplied callback paths using getSafeRedirectTarget before passing them to the signIn helper to avoid open-redirect security vulnerabilities.

## Update Triggers
- When new Server Actions are added to the login page or a dedicated actions file is created.
- When the authentication provider settings in lib/auth.ts change.
- When redirect validation rules or redirect targets are updated.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects auth and tech stack.
- [docs/auth/auth-flow.md](file:///e:/Projects/recallQ/docs/auth/auth-flow.md) — Details authentication.
- [docs/api/route-handlers.md](file:///e:/Projects/recallQ/docs/api/route-handlers.md) — Outlines REST webhooks.

AGENT OWNER: app/(auth)/actions.ts
AGENT UPDATE: docs/api/server-actions.md
