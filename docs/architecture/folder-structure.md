# Folder Structure

> **Scope:** This document explains the purpose of each major directory in the Recally project root. **Rendering context:** N/A **Last updated:** auto

## Overview

The project follows a structure that separates concerns based on Next.js App Router conventions, feature domains, and application layers (UI, logic, data).

## Top-Level Directories

- **`/app`**: The core of the Next.js application, using the App Router.
  - **`/app/(app)`**: Contains the main authenticated application routes and layouts. This route group is used to apply the main app shell layout (`app/(app)/layout.tsx`) to all pages within it.
  - **`/app/(auth)`**: Contains routes related to authentication, like the login page. This route group has its own layout, separate from the main app shell.
  - **`/app/api`**: Holds all API route handlers. These are used for webhooks, and specific client-side interactions that don't use Server Actions.
  - **`/app/globals.css`**: Defines global CSS styles.
  - **`/app/layout.tsx`**: The root layout for the entire application. A Next.js special file.

- **`/components`**: Contains shared, reusable React components used throughout the application. These are often Client Components (`"use client"`) if they involve user interaction or state.

- **`/lib`**: A critical directory containing shared, reusable, server-side business logic.
  - **AGENT NOTE:** Code in this directory should be considered isomorphic or server-only unless explicitly designed for client-side use. It is the central hub for database interactions, external API clients, and core application logic.

- **`/migrations`**: Contains SQL migration files for the PostgreSQL database. These define the database schema changes over time.

- **`/node_modules`**: Standard directory for all npm package dependencies. AGENT AVOID: Do not edit files in this directory.

- **`/public`**: Contains static assets that are served publicly, such as icons, images, and the web app manifest (`manifest.json`).

- **`/scripts`**: Holds standalone Node.js scripts for various maintenance and operational tasks, such as database migrations (`migrate.js`) and webhook registration (`register-telegram-webhook.js`).

- **`/workers`**: Contains long-running or heavy-duty processing scripts that run as background jobs. These are separate from the main Next.js application process. Example: `enrichment-worker.ts`.

- **`/docs`**: (This directory) Contains all AI-readable project documentation.

## Configuration Files

- **`.env.example`**: An example file showing the required environment variables.
- **`.gitignore`**: Specifies files and directories to be ignored by Git.
- **`next.config.mjs`**: The main configuration file for the Next.js application.
- **`package.json`**: Defines project metadata, dependencies, and scripts.
- **`postcss.config.mjs`**: Configuration for PostCSS, used by Tailwind CSS.
- **`tsconfig.json`**: The configuration file for the TypeScript compiler.

## Related Docs

- [docs/overview.md] — Provides a high-level summary of the project architecture.
- [docs/ui/layout-system.md] — Details the specifics of the layouts defined in `/app`.
