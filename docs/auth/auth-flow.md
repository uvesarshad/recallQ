# Authentication Flow

> Scope: Documents user login paths, OAuth and credentials providers, session adapters, route matchers, and developer login bypass modes.
> Rendering context: Isomorphic
> Project tier: 4
> Last updated: 2026-05-17

## Overview
Recall secures all personal workspaces using NextAuth v5 (beta) combined with a database-backed session adapter. Authentication supports social single sign-on via Google OAuth and local email/password credentials. It also features a developer login bypass to simplify local testing on system-installed databases.

## Authentication Providers

### Google OAuth
- Protocol: Secure OAuth 2.0 flow.
- Setup: Configured through the Google Provider inside lib/auth.ts.
- Consumer: Handled by the Google Sign-in Server Action in app/(auth)/actions.ts from the /login page. Redirects the user to Google's authentication page before returning them to /app.

### Email and Password
- Protocol: NextAuth Credentials provider.
- Setup: Configured through the Credentials Provider inside lib/auth.ts.
- Password Storage: app/(auth)/signup/page.tsx submits to app/(auth)/actions.ts, which hashes passwords with the scrypt helper in lib/password.ts and stores the result in users.password_hash.
- Sign-in: The Credentials provider selects the matching user by email and verifies the submitted password hash server-side before issuing the JWT session.

### Password Reset
- Request Page: /forgot-password renders app/(auth)/forgot-password/page.tsx and accepts an email address without exposing whether an account exists.
- Reset Tokens: app/(auth)/actions.ts creates one-time password_reset_tokens rows containing SHA-256 token hashes and one-hour expiration timestamps.
- Delivery: If RESEND_API_KEY and a sender address are configured, a reset email is sent through Resend. In local development without Resend sender configuration, the reset URL is logged to the terminal.
- Reset Page: /reset-password renders app/(auth)/reset-password/page.tsx, verifies the token hash server-side, updates users.password_hash, marks the token used, and sends the user back to /login.

## Auth Pages
- /login: Google OAuth and email/password sign-in form.
- /signup: Dedicated email/password account creation form.
- /forgot-password: Dedicated reset-link request form.
- /reset-password: Dedicated new-password form reached from reset links.
- /app/login: Compatibility redirect to /login for older links and stale middleware redirects.

## Session and Token Strategy
- DB Adapter: Uses PostgresAdapter inside lib/auth.ts, linked to the Postgres Pool. It records users, sessions, and accounts directly in the database.
- Session Configuration: Configured in lib/auth.config.ts. Uses JWT (JSON Web Tokens) as the base session strategy.
- ID Mapping: The NextAuth session callback extracts the verified user ID from the database record or JWT token sub field and maps it to the session.user.id property. This allows all downstream route handlers to query user data securely.

## Developer Login Bypass
To bypass external OAuth logins during local Windows Postgres testing:
- Configuration: Enabled by setting DEV_BYPASS_LOGIN to true in the environment.
- Login Routing: When true, /login and /signup redirect users instantly to /app.
- Session Mock: The custom auth handler in lib/auth.ts bypasses NextAuth entirely. It automatically generates a static developer session containing UUID 00000000-0000-4000-8000-000000000001, name Dev User, and email dev@example.com.
- Auto-Provisioning: The ensureDevUser function automatically upserts this static developer profile into the database's users table upon server initialization.

## Security Constraints
- AGENT AVOID: Never expose GOOGLE_CLIENT_SECRET or RESEND_API_KEY to client components. Authentication configurations must remain server-side.
- AGENT NOTE: Always guarantee that DEV_BYPASS_LOGIN is set to false in production environments to secure live workspaces.

## Update Triggers
- When adding, updating, or deleting NextAuth providers in lib/auth.ts.
- When shifting NextAuth session adapter or token validation settings in lib/auth.config.ts.
- When changing Auth.js URL normalization or credential verification rules in lib/auth.ts.
- When changing developer bypass configurations or static mock parameters.

## Related Docs
- [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) — Connects auth systems.
- [docs/auth/authorization.md](file:///e:/Projects/recallQ/docs/auth/authorization.md) — Details guards.
- [docs/api/server-actions.md](file:///e:/Projects/recallQ/docs/api/server-actions.md) — Login actions.

AGENT OWNER: lib/auth.ts
AGENT UPDATE: docs/auth/auth-flow.md
