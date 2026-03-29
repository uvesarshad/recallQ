# Module: Knowledge Graph

> **Scope:** This document describes the knowledge graph visualization module, including its components, data fetching, and rendering libraries. **Rendering context:** Client **Last updated:** auto

## Overview

The Knowledge Graph is the primary visualization tool in Recally. It allows users to see the entire network of their `Items` and the relationships between them. The module is implemented as a highly interactive, client-rendered component with two distinct view modes: a free-form "Canvas" and a force-directed "Graph".

## Core Component

- **Owner:** `components/KnowledgeMap.tsx`
- **Rendering Context:** This is a Client Component (`"use client"`).
- **Purpose:** To fetch and render the graph data, and handle all user interactions with the graph.

## Data Fetching

- **Endpoint:** `GET /api/graph`
  - **Owner:** `app/api/graph/route.ts`
- **Flow:**
  1. The `KnowledgeMap` component calls the `GET /api/graph` endpoint when it mounts.
  2. The API route authenticates the user, then queries the database for all of the user's `items` and `item_relations`.
  3. It returns a JSON response: `{ nodes: [items...], edges: [relations...] }`.
  4. The component stores this data in its state.
  5. **AGENT NOTE:** The component automatically re-fetches this data every 60 seconds to keep the view in sync with the backend.

## View Modes

The component supports two switchable visualization modes.

### 1. Canvas Mode
- **Library:** `@xyflow/react` (React Flow)
- **Purpose:** Provides a persistent, 2D canvas where items are rendered as nodes. This mode is for manual organization and exploration.
- **Behavior:**
  - Nodes can be freely dragged and dropped. Their positions are saved.
    - **AGENT NOTE:** When a node is dragged, a `PATCH` request is sent to `/api/items/[id]` to update the `canvas_x` and `canvas_y` columns in the `items` table.
  - Nodes can be "pinned" to prevent them from being draggable. This state is saved via a `PATCH` request to update the `canvas_pinned` boolean.
  - Edges are drawn between nodes based on the `item_relations` data.
- **Node Rendering:** Uses a custom React component, `ItemNodeCard`, to display a rich preview of each item.

### 2. Graph Mode
- **Library:** `react-force-graph-2d`
- **Purpose:** Renders a dynamic, force-directed graph that automatically arranges nodes based on the strength of their relationships. This mode is for discovering clusters and unexpected connections.
- **Behavior:**
  - The layout is not persistent and is recalculated on each render.
  - Node positions are determined by the physics simulation of the force-graph library.
- **Node Rendering:** For performance, this mode draws nodes directly on the HTML5 canvas using the `nodeCanvasObject` prop. It renders a simplified representation (a colored square and a text label).

## User Interaction

- **Viewing Item Details:** In either mode, clicking on a node (or item) opens the `ItemDetailModal.tsx` component, displaying the full content and metadata for that item.
- **Switching Views:** A control in the top-left corner allows the user to toggle between "Canvas" and "Graph" modes.

## Related Docs
- [docs/api/route-handlers.md] — Describes the `GET /api/graph` endpoint.
- [docs/api/database.md] — Details the `items` and `item_relations` tables that provide the data.
- [docs/ui/component-library.md] — [PLACEHOLDER: Add details about ItemDetailModal].
