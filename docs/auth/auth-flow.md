# Authentication Flow

> **Scope:** This document explains the user authentication and session management process, powered by NextAuth.js. **Rendering context:** Server/Isomorphic **Last updated:** auto

## Overview

Authentication is handled by the `next-auth` library (v5, a.k.a. `auth.js`). It is configured to use a PostgreSQL database adapter, storing all user and session data in the database. The system supports both OAuth (Google) and passwordless email sign-in.

## Core Configuration

- **Owner:** `lib/auth.ts`
- **Endpoint:** `app/api/auth/[...nextauth]/route.ts` (this file just re-exports handlers from `lib/auth.ts`)
- **Session Strategy:** Database-backed sessions. A session record is created in the `sessions` table upon sign-in.
- **Database Adapter:** `@auth/pg-adapter` is used to sync users, accounts, and sessions with the PostgreSQL database.

## Authentication Providers

The application is configured with two primary authentication methods:

1.  **Google OAuth:**
    - **Provider:** `next-auth/providers/google`
    - **Flow:** Standard OAuth 2.0 flow. The user is redirected to Google, authorizes the application, and is redirected back. NextAuth handles the code exchange and creates a user and account record.
    - **Credentials:** Uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables.

2.  **Passwordless Email (Magic Link):**
    - **Provider:** `next-auth/providers/resend`
    - **Flow:** The user enters their email address on the login page. NextAuth, using Resend, sends them an email with a unique sign-in link. Clicking this link authenticates the user and creates a session.
    - **Credentials:** Uses the `RESEND_API_KEY` and the `APP_DOMAIN` for the "from" address.

## Route Protection & Authorization

- **Protected Routes:** All routes under the `/app/*` path are protected.
- **Mechanism:** Protection is enforced in the `authorized` callback within the `lib/auth.ts` configuration.
  - If a user is not logged in (`!auth?.user`) and tries to access a protected path, the callback returns `false`.
  - NextAuth middleware then redirects the user to the sign-in page.
- **Sign-in Page:** The designated page for all sign-in methods is `/app/login`.
  - **AGENT OWNER:** `app/(auth)/login/page.tsx`

## Session Management

- **Getting the Session (Server-Side):**
  - **Method:** The primary way to get the current user session in Server Components and API Routes is by calling the exported `auth()` function from `lib/auth.ts`.
  - **Example:** `const session = await auth(); const userId = session?.user?.id;`
  - **AGENT AVOID:** Do not import `auth` directly from `next-auth`. Always use the wrapper exported from `lib/auth.ts`.

- **Getting the Session (Client-Side):**
  - **Method:** Client components should use the `useSession` hook from `next-auth/react`. The root layout must be wrapped in a `<SessionProvider>`.
  - **AGENT NOTE:** [PLACEHOLDER: Verify if SessionProvider is used in a layout file.]

## Development Bypass

- **AGENT NOTE:** A special mode exists for local development to bypass authentication entirely.
- **Trigger:** Setting the `DEV_BYPASS_LOGIN` environment variable to `true`.
- **Behavior:**
  - The authentication providers are disabled.
  - All calls to the `auth()` helper function return a hardcoded "Dev User" session.
  - A corresponding user is automatically created in the `users` table.
  - This allows developers to work on protected pages without needing to sign in.

## Related Docs
- [docs/api/database.md] — Describes the `users`, `sessions`, and `accounts` tables used by NextAuth.
- [docs/infra/environment.md] — Lists the required authentication-related environment variables.
