# Recally: AI-Powered Personal Knowledge Management

> **Scope:** This document provides a high-level overview of the Recally project, its architecture, and conventions. It is the primary entry point for AI agents. **Rendering context:** N/A **Last updated:** auto

## Overview

Recally is a Next.js application designed to be a personal "second brain." It allows users to capture, connect, and explore their knowledge through a graph-based interface. The system ingests various data types (text, files, web content), uses AI to enrich and connect them, and provides tools for search, visualization, and retrieval. The primary interface is a web application, with data also accessible via integrations like Telegram and email.

## Project Context

- **Project Name:** recally
- **Purpose:** An AI-powered personal knowledge management and "second brain" application.
- **Tech Stack:**
  - **Framework:** Next.js (App Router)
  - **Language:** TypeScript
  - **Database:** PostgreSQL (using `pg`)
  - **Authentication:** NextAuth.js (`next-auth@beta`)
  - **Styling:** Tailwind CSS
  - **UI:** React, `lucide-react` (icons), `@xyflow/react` & `react-force-graph-2d` (knowledge graph visualization)
  - **AI:** Google Gemini (`@google/generative-ai`)
  - **Background Workers:** Node.js scripts executed with `tsx`.
- **Environment:**
  - **Node Version:** [PLACEHOLDER: Specify required Node.js version, e.g., 20.x]
  - **Next.js Version:** `latest`
  - **Rendering Strategy:** Primarily Server-Side Rendering (SSR) with Server Components. Client-Side Rendering (CSR) is used for highly interactive components.
  - **Deployment Target:** [PLACEHOLDER: Specify deployment platform, e.g., Vercel, AWS Amplify]

## Documentation Directory

- `docs/overview.md`: (This file) The main entry point for understanding the project.
- `docs/architecture/folder-structure.md`: Explains the purpose of each top-level directory.
- `docs/architecture/data-flow.md`: Describes how data moves through the application.
- `docs/api/route-handlers.md`: Details all Next.js API route handlers.
- `docs/api/database.md`: Describes the PostgreSQL database schema and conventions.
- `docs/auth/auth-flow.md`: Explains the user authentication and session management process.
- `docs/modules/ingestion.md`: Covers the system for capturing data from various sources.
- `docs/modules/enrichment.md`: Details the AI-powered background job for processing items.
- `docs/modules/graph.md`: Explains the knowledge graph visualization and data fetching.
- `docs/ui/layout-system.md`: Describes the main application shell and layout structure.

## Key Architectural Decisions

- **App Router First:** The project uses the Next.js App Router, favoring Server Components for data fetching and rendering to keep the client-side bundle small.
- **Server Components by Default:** Most components are Server Components. Client Components (marked with `"use client"`) are used only when interactivity is required and are typically located in the `components/` directory or as client-only page entry points.
- **Centralized Data Logic in `lib/`:** Business logic, database queries, and external API interactions are consolidated in the `lib/` directory, separating them from the UI layer.
- **API Routes for External Services:** API route handlers in `app/api/` are used primarily as endpoints for webhooks (e.g., Telegram, email) and for tasks that cannot be accomplished in Server Actions.
- **Asynchronous Processing with Workers:** Computationally intensive or long-running tasks, like AI enrichment and sending reminders, are handled by standalone worker scripts in the `workers/` directory to avoid blocking the main application thread.

## Cross-Cutting Concerns

- **Authentication:** Handled by `next-auth`. The main configuration is in `app/api/auth/[...nextauth]/route.ts`, with session data managed via server-side utilities in `lib/auth.ts`. Most pages and APIs require an authenticated session.
- **Data Fetching:** Primarily done in Server Components by directly calling functions from `lib/`. Client-side data fetching is used for dynamic UI elements and uses standard `fetch` calls to the application's API routes.
- **Styling:** Tailwind CSS is used for all styling. Global styles are in `app/globals.css`. The `clsx` and `tailwind-merge` utilities are used for constructing conditional class names.
- **Error Handling:** [PLACEHOLDER: Describe the primary error handling strategy, e.g., `error.tsx` files, try/catch blocks in API routes, etc.]

## Glossary

- **Item:** The fundamental unit of data in Recally. An item can be a note, a file, a bookmark, or any piece of information captured by the user.
- **Capture:** The process of creating a new Item. This can be done through the main UI (`CaptureBar.tsx`), email, Telegram, or other integrations.
- **Ingestion:** The backend process that receives captured data, parses it, and creates a new Item in the database. Governed by `app/api/ingest/route.ts`.
- **Enrichment:** An asynchronous background process (`workers/enrichment-worker.ts`) that uses AI (Google Gemini) to analyze an Item's content, generate a title, summary, and embeddings for vector search.
- **Graph:** The network of all Items, visualized as a 2D force-directed graph in `components/KnowledgeMap.tsx`. Relationships between items are stored in the database.
- **Collection:** A user-curated group of Items.
