"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronDown, ChevronUp, Pin, PinOff, RefreshCw, Search } from "lucide-react";
import ItemDetailModal from "@/components/ItemDetailModal";
import { resolvePreviewImageUrl } from "@/lib/item-preview";
import { ARCHIVE_ITEM_CREATED_EVENT, ARCHIVE_ITEMS_CHANGED_EVENT } from "@/lib/archive-events";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type HeaderNodeData = { label: string; count: number };

// We use a union type with discriminated "type" field handled by nodeTypes map.
type CanvasFlowNode = Node<ItemNodeData, "item"> | Node<HeaderNodeData, "header">;

// ─── Constants ───────────────────────────────────────────────────────────────

const CARD_W = 240;
const CARD_H_IMG = 232;   // image area (130px) + content (102px)
const CARD_H_TEXT = 172;  // text preview (70px) + content (102px)
const COL_STEP = CARD_W + 56;
const ROW_GAP = 16;
const HEADER_H = 56;
const START_X = 40;
const START_Y = 40;

const typeGradient: Record<string, string> = {
  url:  "from-sky-600  to-sky-800",
  text: "from-green-600 to-green-800",
  note: "from-teal-600  to-teal-800",
  file: "from-orange-600 to-orange-800",
};

const typeBadge: Record<string, string> = {
  url:  "bg-sky-600",
  text: "bg-green-600",
  note: "bg-teal-600",
  file: "bg-orange-600",
};

const allTypes = ["url", "text", "note", "file"] as const;
type ItemType = (typeof allTypes)[number];

const typeLabel: Record<ItemType, string> = {
  url: "Links", text: "Text", note: "Notes", file: "Files",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTitle(item: CanvasItem) {
  return item.title || item.file_name || item.raw_url || "Untitled";
}

function matchesQuery(item: CanvasItem, q: string) {
  if (!q) return true;
  const lower = q.toLowerCase();
  return [getTitle(item), item.summary, item.raw_url, item.collection_name, ...(item.tags ?? [])]
    .filter(Boolean).join(" ").toLowerCase().includes(lower);
}

/** Group items that have no saved canvas position into swimlane buckets. */
function groupUnpositioned(items: CanvasItem[]): Map<string, CanvasItem[]> {
  const groups = new Map<string, CanvasItem[]>();
  for (const item of items) {
    const key =
      item.collection_name ||
      (item.tags?.[0] ? `#${item.tags[0]}` : "Other");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

/** Compute swimlane positions for items without a saved canvas position. */
function buildSwimlanePositions(
  groups: Map<string, CanvasItem[]>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  let colX = START_X;
  for (const [, colItems] of Array.from(groups)) {
    let rowY = START_Y + HEADER_H;
    for (const item of colItems) {
      positions.set(item.id, { x: colX, y: rowY });
      rowY += (item.image_url ? CARD_H_IMG : CARD_H_TEXT) + ROW_GAP;
    }
    colX += COL_STEP;
  }
  return positions;
}

// ─── Item card node ───────────────────────────────────────────────────────────

function ItemCard({ data }: NodeProps) {
  const { item, onTogglePinned, onOpen } = data as ItemNodeData;
  const title = getTitle(item);
  const previewUrl = resolvePreviewImageUrl(item.image_url, item.raw_url);

  return (
    <div
      className="w-[240px] cursor-pointer overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-lg"
      onClick={() => onOpen(item.id)}
    >
      {previewUrl ? (
        <div className="h-[130px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className={`flex h-[70px] items-center justify-center bg-gradient-to-br p-3 ${typeGradient[item.type] ?? typeGradient.note}`}
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
            onClick={(e) => { e.stopPropagation(); void onTogglePinned(item); }}
            title={item.canvas_pinned ? "Unpin" : "Pin to canvas"}
          >
            {item.canvas_pinned
              ? <Pin className="h-3 w-3 text-brand" />
              : <PinOff className="h-3 w-3" />}
          </button>
        </div>

        {(item.tags?.length ?? 0) > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] text-text-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

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

// ─── Group header node ────────────────────────────────────────────────────────

function GroupHeader({ data }: NodeProps) {
  const { label, count } = data as HeaderNodeData;
  return (
    <div className="w-[240px] rounded-lg border border-border/40 bg-surface/80 px-3 py-2 backdrop-blur-sm">
      <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">{label}</div>
      <div className="text-[10px] text-text-muted/60">{count} item{count !== 1 ? "s" : ""}</div>
    </div>
  );
}

const nodeTypes = { item: ItemCard, header: GroupHeader };

// ─── Main component ───────────────────────────────────────────────────────────

export default function KnowledgeMap() {
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [flowNodes, setFlowNodes] = useState<CanvasFlowNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [activeTypes, setActiveTypes] = useState<ItemType[]>([...allTypes]);

  // ── Toggle pinned ──────────────────────────────────────────────────────────

  const handleTogglePinned = useCallback(async (item: CanvasItem) => {
    const next = !item.canvas_pinned;
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvas_pinned: next }),
    });
    if (!res.ok) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, canvas_pinned: next } : i)),
    );
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────

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

  useEffect(() => {
    void loadCanvas();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadCanvas();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [loadCanvas]);

  useEffect(() => {
    const refresh = () => void loadCanvas();
    window.addEventListener(ARCHIVE_ITEM_CREATED_EVENT, refresh);
    window.addEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(ARCHIVE_ITEM_CREATED_EVENT, refresh);
      window.removeEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, refresh);
    };
  }, [loadCanvas]);

  // ── Build flow nodes whenever items change ─────────────────────────────────

  useEffect(() => {
    const unpositioned = items.filter(
      (i) => typeof i.canvas_x !== "number" || typeof i.canvas_y !== "number",
    );
    const groups = groupUnpositioned(unpositioned);
    const swimlane = buildSwimlanePositions(groups);

    // Build header nodes (one per swimlane column)
    const headerNodes: CanvasFlowNode[] = [];
    let colX = START_X;
    for (const [label, colItems] of Array.from(groups)) {
      headerNodes.push({
        id: `__header__${label}`,
        type: "header",
        data: { label, count: colItems.length },
        position: { x: colX, y: START_Y },
        selectable: false,
        draggable: false,
        connectable: false,
      } as Node<HeaderNodeData, "header">);
      colX += COL_STEP;
    }

    // Build item nodes
    const itemNodes: CanvasFlowNode[] = items.map((item) => {
      const saved =
        typeof item.canvas_x === "number" && typeof item.canvas_y === "number";
      const pos = saved
        ? { x: item.canvas_x!, y: item.canvas_y! }
        : (swimlane.get(item.id) ?? { x: 0, y: 0 });

      return {
        id: item.id,
        type: "item",
        data: {
          item,
          onTogglePinned: handleTogglePinned,
          onOpen: (id: string) => setSelectedId(id),
        },
        position: pos,
        draggable: true,
      } as Node<ItemNodeData, "item">;
    });

    setFlowNodes([...headerNodes, ...itemNodes]);
  }, [items, handleTogglePinned]);

  // ── Filtered view ──────────────────────────────────────────────────────────

  const visibleNodes = useMemo(() => {
    const visibleItemIds = new Set(
      items
        .filter(
          (item) =>
            activeTypes.includes(item.type as ItemType) &&
            (!showPinnedOnly || item.canvas_pinned) &&
            matchesQuery(item, query),
        )
        .map((i) => i.id),
    );

    return flowNodes.filter(
      (n) => n.id.startsWith("__header__") || visibleItemIds.has(n.id),
    );
  }, [flowNodes, items, activeTypes, showPinnedOnly, query]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((prev) => applyNodeChanges(changes, prev) as CanvasFlowNode[]);
  }, []);

  function toggleType(type: ItemType) {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  const visibleItemCount = visibleNodes.filter((n) => !n.id.startsWith("__header__")).length;

  return (
    <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-bg">
      {/* ── Controls panel ─────────────────────────────────────────────────── */}
      <div className="absolute left-4 top-4 z-20 flex w-72 flex-col gap-3">
        {/* Toolbar row */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-border/50 bg-surface/90 p-1.5 shadow-xl backdrop-blur-xl">
          <span className="flex-1 px-2 text-sm font-semibold text-text-primary">Canvas</span>
          <button
            className="group rounded-xl p-2 text-text-muted transition hover:bg-surface-2 hover:text-brand"
            onClick={() => void loadCanvas()}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : "group-active:rotate-180 transition-transform duration-500"}`} />
          </button>
          <button
            className="rounded-xl p-2 text-text-muted transition hover:bg-surface-2 hover:text-brand"
            onClick={() => setControlsOpen((v) => !v)}
            title={controlsOpen ? "Collapse" : "Expand"}
          >
            {controlsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Filters */}
        {controlsOpen && (
          <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-surface/90 p-4 shadow-xl backdrop-blur-xl">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-bg/50 px-3 py-2 focus-within:border-brand/50">
              <Search className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, tag, source…"
                className="w-full bg-transparent text-[12px] text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>

            {/* Type toggles */}
            <div className="flex flex-wrap gap-1.5">
              {allTypes.map((type) => {
                const active = activeTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                      active
                        ? `border-transparent text-white ${typeBadge[type]}`
                        : "border-border/40 bg-bg/40 text-text-muted hover:border-brand/30 hover:text-text-primary"
                    }`}
                  >
                    {typeLabel[type]}
                  </button>
                );
              })}
            </div>

            {/* Pinned toggle */}
            <button
              type="button"
              onClick={() => setShowPinnedOnly((v) => !v)}
              className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-[11px] font-medium transition ${
                showPinnedOnly
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border/40 bg-bg/40 text-text-muted hover:border-brand/20"
              }`}
            >
              {showPinnedOnly ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
              Pinned only
            </button>

            <div className="border-t border-border/20 pt-2 text-center text-[11px] text-text-muted">
              {visibleItemCount} item{visibleItemCount !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* ── Status overlays ────────────────────────────────────────────────── */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? "Loading canvas" : error ?? ""}
      </div>

      {error && (
        <div className="absolute right-4 top-4 z-20 max-w-xs rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
          <button type="button" onClick={() => void loadCanvas()} className="mt-1 block text-xs font-medium text-rose-200">
            Retry
          </button>
        </div>
      )}

      {!loading && visibleItemCount === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-xl">
            <h2 className="text-base font-semibold text-text-primary">Nothing to show</h2>
            <p className="mt-2 text-sm text-text-muted">
              Save some items first, or broaden the filters.
            </p>
          </div>
        </div>
      )}

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <ReactFlowProvider>
        <ReactFlow
          nodes={visibleNodes}
          edges={[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            if (!node.id.startsWith("__header__")) setSelectedId(node.id);
          }}
          onNodeDragStop={async (_, node) => {
            if (node.id.startsWith("__header__")) return;
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
        >
          <MiniMap
            nodeColor={(n) => {
              if (n.id.startsWith("__header__")) return "#52525b";
              const item = (n.data as ItemNodeData | undefined)?.item;
              if (!item) return "#6366f1";
              return { url: "#38bdf8", text: "#22c55e", note: "#14b8a6", file: "#fb923c" }[item.type] ?? "#6366f1";
            }}
            nodeStrokeWidth={0}
          />
          <Background gap={24} color="rgba(113,113,122,0.12)" />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>

      <ItemDetailModal
        itemId={selectedId ?? ""}
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
