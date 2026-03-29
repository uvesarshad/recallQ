# UI: Layout System

> **Scope:** This document describes the hierarchy and structure of the application's layouts, including the root layout and the main application shell. **Rendering context:** Isomorphic **Last updated:** auto

## Overview

The application uses a nested layout system powered by the Next.js App Router. This approach allows for shared UI across different sections of the app while keeping layouts for distinct areas (like authentication vs. the main app) separate.

## Layout Hierarchy

The layout structure is composed of three main parts, nested within each other:

1.  **Root Layout (`/app/layout.tsx`)**
2.  **App Group Layout (`/app/(app)/layout.tsx`)**
3.  **App Shell Component (`/components/AppShell.tsx`)**

---

### 1. Root Layout

- **File:** `app/layout.tsx`
- **Next.js Type:** Root Layout
- **Rendering Context:** Server
- **Purpose:** This is the top-level layout that applies to every single page in the application.
- **Responsibilities:**
  - Defines the `<html>` and `<body>` tags.
  - Includes global styles from `app/globals.css`.
  - Sets the base HTML metadata (title, description).
  - **Theme Persistence:** Contains an inline script in the `<head>` to immediately apply the user's preferred theme ('dark' or 'light') from `localStorage`. This prevents a flash of the wrong theme on initial load. AGENT NOTE: This is a critical piece of the theming system.

### 2. App Group Layout

- **File:** `app/(app)/layout.tsx`
- **Next.js Type:** Nested Layout
- **Rendering Context:** Server
- **Purpose:** This layout wraps all pages within the main, authenticated part of the application. It uses a Next.js route group `(app)` to apply itself to all child routes.
- **Responsibilities:**
  - **Authentication Guard:** This is the primary guard for the authenticated application. It calls `await auth()` from `lib/auth.ts` to get the user's session. If there is no session, it returns `null`, and the `next-auth` middleware redirects the user to the login page.
  - **Wraps with AppShell:** It renders the `<AppShell>` component, passing the authenticated user's data (`name`, `email`, `image`) as props.
  - **PWA Setup:** It includes the `<PWASetup />` component, which likely handles service worker registration and other PWA-related browser features.

### 3. App Shell Component

- **File:** `components/AppShell.tsx`
- **Rendering Context:** Client (`"use client"`)
- **Purpose:** This component is the main, visible user interface that frames the application's content.
- **Features:**
  - **Collapsible Sidebar:** A persistent left-hand sidebar containing:
    - Navigation links to the main pages (`/app`, `/app/canvas`, etc.).
    - A theme toggle button (light/dark).
    - User profile information and avatar at the bottom.
  - **Sticky Header:** A header at the top of the content area containing:
    - A global search bar.
    - A "Create" button which triggers the `CreateItemDialog` modal.
  - **Content Area:** Renders the `children` prop, which is the actual Next.js page being displayed.

---

## Other Layouts

### Auth Group

- **Path:** `/app/(auth)/`
- **Purpose:** This route group contains pages related to the authentication process, such as the login page (`/app/(auth)/login/page.tsx`).
- **Structure:** Pages in this group are **not** wrapped by the `App Group Layout`. They are only wrapped by the `Root Layout`. This is the standard pattern for keeping login/signup pages separate from the main application UI.

## Related Docs
- [docs/architecture/folder-structure.md] — Explains the purpose of the `/app` and `/components` directories.
- [docs/auth/auth-flow.md] — Describes how the `App Group Layout` acts as an authentication guard.
- [docs/ui/theming.md] — [PLACEHOLDER: To be created] Will detail the theme-switching mechanism.
