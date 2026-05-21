"use client";

// Freeform infinite canvas — Stage 3 of PLAN.md stripped this from the original
// xyflow-based KnowledgeMap (~510 lines) down to the Excalidraw-style minimum:
// pan, zoom, drag, persist. No type-column headers, no in-canvas search, no
// type filters, no MiniMap, no ReactFlow Controls — those all lived in a side
// panel that we removed. Items load from the existing /api/graph endpoint and
// persist their `canvas_x` / `canvas_y` / `canvas_pinned` via PATCH. New items
// captured anywhere in the app (PWA, extension, Telegram, etc.) appear at the
// center of the user's current viewport.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Maximize2, Pin, PinOff, Plus, RefreshCw } from "lucide-react";
import ItemDetailModal from "@/components/ItemDetailModal";
import { openCreateDialog } from "@/components/CreateItemDialog";
import { resolvePreviewImageUrl } from "@/lib/item-preview";
import { ARCHIVE_ITEM_CREATED_EVENT, ARCHIVE_ITEMS_CHANGED_EVENT } from "@/lib/archive-events";

interface CanvasItem {
  id: string;
  type: "url" | "text" | "file" | "note";
  title: string | null;
  summary: string | null;
  tags: string[];
  raw_url: string | null;
  source: string;
  file_name: string | null;
  collection_id: string | null;
  collection_name: string | null;
  canvas_x: number | null;
  canvas_y: number | null;
  canvas_pinned: boolean;
  enriched: boolean;
  image_url: string | null;
  created_at: string;
}

type ItemNodeData = {
  item: CanvasItem;
  onTogglePinned: (item: CanvasItem) => Promise<void>;
  onOpen: (id: string) => void;
};

type CanvasFlowNode = Node<ItemNodeData, "item">;

const CARD_W = 240;
const CARD_H = 200;
const GRID_COLS = 4;
const GRID_X_STEP = CARD_W + 40;
const GRID_Y_STEP = CARD_H + 24;
const GRID_ORIGIN_X = 40;
const GRID_ORIGIN_Y = 40;

const typeGradient: Record<string, string> = {
  url: "from-sky-600 to-sky-800",
  text: "from-green-600 to-green-800",
  note: "from-teal-600 to-teal-800",
  file: "from-orange-600 to-orange-800",
};

const typeBadge: Record<string, string> = {
  url: "bg-sky-600",
  text: "bg-green-600",
  note: "bg-teal-600",
  file: "bg-orange-600",
};

function getTitle(item: CanvasItem) {
  return item.title || item.file_name || item.raw_url || "Untitled";
}

// Position fallback for items without saved canvas coordinates: deterministic
// 4-col grid by creation order so the layout is stable across reloads. As soon
// as the user drags an item, its real x/y is persisted and this fallback is
// no longer used for that item.
function gridPosition(index: number): { x: number; y: number } {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: GRID_ORIGIN_X + col * GRID_X_STEP,
    y: GRID_ORIGIN_Y + row * GRID_Y_STEP,
  };
}

function ItemCardNode({ data }: NodeProps) {
  const { item, onTogglePinned, onOpen } = data as ItemNodeData;
  const title = getTitle(item);
  const previewUrl = resolvePreviewImageUrl(item.image_url, item.raw_url);

  return (
    <div
      className="w-[240px] cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-lg"
      onClick={() => onOpen(item.id)}
      style={{ height: CARD_H }}
    >
      {previewUrl ? (
        <div className="h-[110px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className={`flex h-[110px] items-center justify-center bg-gradient-to-br p-3 ${typeGradient[item.type] ?? typeGradient.note}`}
        >
          <p className="line-clamp-3 text-center text-[11px] leading-relaxed text-white/90">
            {item.summary || item.raw_url || title}
          </p>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[12px] font-semibold leading-snug text-text-primary">
            {title}
          </h3>
          <button
            className="shrink-0 rounded p-1 text-text-muted transition hover:text-brand"
            onClick={(e) => {
              e.stopPropagation();
              void onTogglePinned(item);
            }}
            title={item.canvas_pinned ? "Unpin" : "Pin to canvas"}
          >
            {item.canvas_pinned ? (
              <Pin className="h-3 w-3 text-brand" />
            ) : (
              <PinOff className="h-3 w-3" />
            )}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${typeBadge[item.type] ?? typeBadge.note}`}
          >
            {item.type === "url" ? "link" : item.type}
          </span>
          <span className="text-[10px] text-text-muted" suppressHydrationWarning>
            {new Date(item.created_at).toLocaleDateString()}
          </span>
          {!item.enriched && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" title="Processing…" />
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { item: ItemCardNode };

function KnowledgeMapInner() {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [flowNodes, setFlowNodes] = useState<CanvasFlowNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { getViewport, fitView } = useReactFlow();

  // Item position handling: persisted x/y wins; otherwise a deterministic
  // grid slot based on order in the items array.
  const positionFor = useCallback((item: CanvasItem, index: number) => {
    if (typeof item.canvas_x === "number" && typeof item.canvas_y === "number") {
      return { x: item.canvas_x, y: item.canvas_y };
    }
    return gridPosition(index);
  }, []);

  // Viewport center in canvas coordinates. Used when a new item is captured
  // anywhere in the app so it lands where the user is currently looking.
  const viewportCenter = useCallback(() => {
    const vp = getViewport();
    const w = containerRef.current?.clientWidth ?? window.innerWidth;
    const h = containerRef.current?.clientHeight ?? window.innerHeight;
    return {
      x: (-vp.x + w / 2) / vp.zoom - CARD_W / 2,
      y: (-vp.y + h / 2) / vp.zoom - CARD_H / 2,
    };
  }, [getViewport]);

  const handleTogglePinned = useCallback(async (item: CanvasItem) => {
    const next = !item.canvas_pinned;
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvas_pinned: next }),
    });
    if (!res.ok) return;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, canvas_pinned: next } : i)));
  }, []);

  const loadCanvas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/graph");
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { nodes: CanvasItem[] };
      setItems(data.nodes);
    } catch {
      setError("Could not load the canvas right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + periodic refresh while the tab is visible.
  useEffect(() => {
    void loadCanvas();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadCanvas();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [loadCanvas]);

  // When an item is captured anywhere in the app, immediately persist a
  // canvas position at the current viewport center, then refresh. When items
  // change otherwise (delete, tag edit, etc.), just refresh.
  useEffect(() => {
    async function handleCreated(event: Event) {
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      const itemId = detail?.itemId;
      if (itemId) {
        const pos = viewportCenter();
        try {
          await fetch(`/api/items/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canvas_x: pos.x, canvas_y: pos.y }),
          });
        } catch {
          // Position persistence is best-effort; the grid fallback handles it
          // on the next reload either way.
        }
      }
      void loadCanvas();
    }

    function handleChanged() {
      void loadCanvas();
    }

    window.addEventListener(ARCHIVE_ITEM_CREATED_EVENT, handleCreated as EventListener);
    window.addEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, handleChanged);
    return () => {
      window.removeEventListener(ARCHIVE_ITEM_CREATED_EVENT, handleCreated as EventListener);
      window.removeEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, handleChanged);
    };
  }, [loadCanvas, viewportCenter]);

  // Rebuild flow nodes whenever items change.
  useEffect(() => {
    const nextNodes: CanvasFlowNode[] = items.map((item, index) => ({
      id: item.id,
      type: "item",
      data: {
        item,
        onTogglePinned: handleTogglePinned,
        onOpen: (id: string) => setSelectedId(id),
      },
      position: positionFor(item, index),
      draggable: true,
    }));
    setFlowNodes(nextNodes);
  }, [items, handleTogglePinned, positionFor]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((prev) => applyNodeChanges(changes, prev) as CanvasFlowNode[]);
  }, []);

  return (
    <div ref={containerRef} className="relative h-[calc(100vh-4rem)] overflow-hidden bg-bg">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? "Loading canvas" : error ?? ""}
      </div>

      {error && (
        <div className="absolute right-4 top-4 z-20 max-w-xs rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
          <button
            type="button"
            onClick={() => void loadCanvas()}
            className="mt-1 block text-xs font-medium text-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-xl">
            <h2 className="text-base font-semibold text-text-primary">Your canvas is empty</h2>
            <p className="mt-2 text-sm text-text-muted">
              Capture a link, note, or file and it will land here. Drag items anywhere — positions are saved automatically.
            </p>
            <button
              type="button"
              onClick={() => openCreateDialog()}
              className="mt-4 inline-flex items-center gap-2 rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Capture
            </button>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onNodeDragStop={async (_, node) => {
          await fetch(`/api/items/${node.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canvas_x: node.position.x, canvas_y: node.position.y }),
          });
        }}
        fitView
        className="bg-bg"
        minZoom={0.1}
        maxZoom={2}
        panOnScroll
        selectionOnDrag={false}
      >
        <Background gap={24} color="rgba(113,113,122,0.12)" />
      </ReactFlow>

      {/* Floating dock — Capture, Fit to viewport, Refresh. Replaces the old
          left-side controls panel; visible only when there are items so the
          empty-state CTA owns the screen on first load. */}
      {items.length > 0 && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 rounded-2xl border border-border/50 bg-surface/90 p-1.5 shadow-xl backdrop-blur-xl">
          <button
            type="button"
            onClick={() => openCreateDialog()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white"
            title="Capture (⌘⇧C)"
          >
            <Plus className="h-4 w-4" />
            Capture
          </button>
          <button
            type="button"
            onClick={() => fitView({ duration: 300, padding: 0.2 })}
            className="rounded-xl p-2 text-text-muted transition hover:bg-surface-2 hover:text-brand"
            title="Fit to viewport"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void loadCanvas()}
            className="rounded-xl p-2 text-text-muted transition hover:bg-surface-2 hover:text-brand"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      <ItemDetailModal
        itemId={selectedId ?? ""}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

export default function KnowledgeMap() {
  return (
    <ReactFlowProvider>
      <KnowledgeMapInner />
    </ReactFlowProvider>
  );
}
