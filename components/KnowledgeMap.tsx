"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  Handle,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import type { LinkObject, NodeObject } from "react-force-graph-2d";
import "@xyflow/react/dist/style.css";
import { Filter, Pin, PinOff, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import ItemDetailModal from "@/components/ItemDetailModal";
import { ARCHIVE_ITEM_CREATED_EVENT, ARCHIVE_ITEMS_CHANGED_EVENT } from "@/lib/archive-events";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type ViewMode = "canvas" | "graph";

interface GraphNode {
  id: string;
  type: "url" | "text" | "file" | "note";
  title: string | null;
  summary: string | null;
  tags: string[];
  raw_url: string | null;
  source: string;
  file_name: string | null;
  collection_id: string | null;
  canvas_x: number | null;
  canvas_y: number | null;
  canvas_pinned: boolean;
  enriched: boolean;
  image_url: string | null;
  created_at: string;
}

interface GraphEdgeRecord {
  id: string;
  item_a_id: string;
  item_b_id: string;
  relation_type: "ai_similar" | "ai_same_domain" | "ai_topic" | "user_linked";
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdgeRecord[];
}

type ItemNodeData = {
  item: GraphNode;
  onTogglePinned: (item: GraphNode) => void;
};

type ItemFlowNode = Node<ItemNodeData, "recallItem">;
type GraphCanvasNode = NodeObject<GraphNode & { color: string; nodeTypeColor: string }>;
type GraphCanvasLink = LinkObject<GraphNode & { color: string; nodeTypeColor: string }, GraphEdgeRecord>;

const relationLabels: Record<GraphEdgeRecord["relation_type"], string> = {
  ai_similar: "Similar",
  ai_same_domain: "Same domain",
  ai_topic: "Topic",
  user_linked: "Manual",
};

const typeColors: Record<GraphNode["type"], string> = {
  url: "#38bdf8",
  text: "#84cc16",
  note: "#84cc16",
  file: "#fb923c",
};

const typeLabels: Record<GraphNode["type"], string> = {
  url: "Links",
  text: "Text",
  note: "Notes",
  file: "Files",
};

const collectionColors = ["#38bdf8", "#22c55e", "#f97316", "#e879f9", "#facc15", "#14b8a6"];
const allTypes: GraphNode["type"][] = ["url", "text", "note", "file"];

function fallbackPosition(index: number) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 120 + col * 290, y: 100 + row * 190 };
}

function getTitle(node: GraphNode) {
  return node.title || node.file_name || node.raw_url || "Untitled";
}

function getCollectionColor(collectionId: string | null) {
  if (!collectionId) return "#6366f1";

  let hash = 0;
  for (let i = 0; i < collectionId.length; i += 1) {
    hash = (hash + collectionId.charCodeAt(i)) % collectionColors.length;
  }

  return collectionColors[hash];
}

function matchesNodeQuery(node: GraphNode, query: string) {
  if (!query) {
    return true;
  }

  const normalized = query.toLowerCase();
  const haystack = [
    getTitle(node),
    node.summary,
    node.raw_url,
    node.file_name,
    node.source,
    ...(node.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function ItemNodeCard({ data }: NodeProps<ItemFlowNode>) {
  const item = data.item;

  return (
    <div
      className="w-[280px] overflow-hidden rounded-canvas border border-border bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
      style={{
        borderLeft: `4px solid ${getCollectionColor(item.collection_id)}`,
      }}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-4 !rounded-none !border-none !bg-brand/20 hover:!bg-brand transition-colors" />
      
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="mb-2 inline-flex items-center rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
              style={{ backgroundColor: typeColors[item.type] }}
            >
              {item.type}
            </div>
            <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-text-primary">
              {getTitle(item)}
            </div>
          </div>
          <button
            className={`flex-shrink-0 rounded-lg p-1.5 transition-colors ${
              item.canvas_pinned 
                ? "bg-brand/10 text-brand" 
                : "text-text-muted hover:bg-surface-2 hover:text-text-primary"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              data.onTogglePinned(item);
            }}
            title={item.canvas_pinned ? "Unpin from canvas" : "Pin to canvas"}
          >
            {item.canvas_pinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      
      <div className="space-y-3 bg-surface/30 px-4 py-3">
        <p className="line-clamp-3 text-[11px] leading-relaxed text-text-mid">
          {item.summary || item.raw_url || item.source}
        </p>
        
        <div className="flex flex-wrap items-center gap-1.5">
          {item.tags.slice(0, 3).map((tag) => (
            <span 
              key={tag} 
              className="rounded bg-bg/80 border border-border/30 px-1.5 py-0.5 text-[9px] font-medium text-text-muted"
            >
              {tag}
            </span>
          ))}
          {!item.enriched && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand"></span>
              </span>
              <span className="text-[10px] font-medium text-brand/80">Processing</span>
            </div>
          )}
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-4 !rounded-none !border-none !bg-brand/20 hover:!bg-brand transition-colors" />
    </div>
  );
}

const nodeTypes = {
  recallItem: ItemNodeCard,
};

export default function KnowledgeMap({ initialMode }: { initialMode: ViewMode }) {
  const [view, setView] = useState<ViewMode>(initialMode);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [flowNodes, setFlowNodes] = useState<ItemFlowNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [minStrength, setMinStrength] = useState(0.75);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [activeTypes, setActiveTypes] = useState<GraphNode["type"][]>(allTypes);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/graph");
      if (!response.ok) {
        throw new Error("Failed to load graph");
      }
      const data = (await response.json()) as GraphData;
      setGraphData(data);
      setFlowNodes(
        data.nodes.map((node, index) => ({
          id: node.id,
          type: "recallItem",
          data: {
            item: node,
            onTogglePinned: async (current: GraphNode) => {
              const response = await fetch(`/api/items/${current.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ canvas_pinned: !current.canvas_pinned }),
              });
              if (!response.ok) {
                return;
              }

              setGraphData((existing) => ({
                ...existing,
                nodes: existing.nodes.map((node) =>
                  node.id === current.id
                    ? { ...node, canvas_pinned: !current.canvas_pinned }
                    : node,
                ),
              }));
              setFlowNodes((existing) =>
                existing.map((node) =>
                  node.id === current.id
                    ? {
                        ...node,
                        draggable: current.canvas_pinned,
                        data: {
                          ...node.data,
                          item: {
                            ...node.data.item,
                            canvas_pinned: !current.canvas_pinned,
                          },
                        },
                      }
                    : node,
                ),
              );
            },
          },
          draggable: !node.canvas_pinned,
          position:
            typeof node.canvas_x === "number" && typeof node.canvas_y === "number"
              ? { x: node.canvas_x, y: node.canvas_y }
              : fallbackPosition(index),
        })),
      );
    } catch {
      setError("The knowledge map could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadGraph();
      }
    }, 60000);

    return () => window.clearInterval(interval);
  }, [loadGraph]);

  useEffect(() => {
    const refresh = () => void loadGraph();
    window.addEventListener(ARCHIVE_ITEM_CREATED_EVENT, refresh);
    window.addEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, refresh);

    return () => {
      window.removeEventListener(ARCHIVE_ITEM_CREATED_EVENT, refresh);
      window.removeEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, refresh);
    };
  }, [loadGraph]);

  const visibleNodes = useMemo(
    () =>
      graphData.nodes.filter(
        (node) =>
          activeTypes.includes(node.type) &&
          (!showPinnedOnly || node.canvas_pinned) &&
          matchesNodeQuery(node, query),
      ),
    [activeTypes, graphData.nodes, query, showPinnedOnly],
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      graphData.edges.filter(
        (edge) =>
          edge.strength >= minStrength &&
          visibleNodeIds.has(edge.item_a_id) &&
          visibleNodeIds.has(edge.item_b_id),
      ),
    [graphData.edges, minStrength, visibleNodeIds],
  );

  const visibleFlowNodes = useMemo(
    () => flowNodes.filter((node) => visibleNodeIds.has(node.id)),
    [flowNodes, visibleNodeIds],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      visibleEdges.map((edge) => ({
        id: edge.id,
        source: edge.item_a_id,
        target: edge.item_b_id,
        label: relationLabels[edge.relation_type],
        animated: edge.relation_type === "user_linked",
        style: { stroke: "#6366f1", strokeWidth: 1 + edge.strength * 2 },
        labelStyle: { fill: "#71717a", fontSize: 11 },
      })),
    [visibleEdges],
  );

  const graphCanvasData = useMemo(
    () => ({
      nodes: visibleNodes.map((node) => ({
        ...node,
        color: getCollectionColor(node.collection_id),
        nodeTypeColor: typeColors[node.type],
      })),
      links: visibleEdges.map((edge) => ({
        ...edge,
        source: edge.item_a_id,
        target: edge.item_b_id,
      })),
    }),
    [visibleEdges, visibleNodes],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((current) => applyNodeChanges(changes, current) as ItemFlowNode[]);
  }, []);

  useEffect(() => {
    if (selectedId && !visibleNodeIds.has(selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleNodeIds]);

  function toggleType(type: GraphNode["type"]) {
    setActiveTypes((current) =>
      current.includes(type)
        ? current.filter((entry) => entry !== type)
        : [...current, type],
    );
  }

  function resetFilters() {
    setQuery("");
    setMinStrength(0.75);
    setShowPinnedOnly(false);
    setActiveTypes(allTypes);
  }

  const pinnedCount = visibleNodes.filter((node) => node.canvas_pinned).length;
  const averageStrength =
    visibleEdges.length > 0
      ? (visibleEdges.reduce((total, edge) => total + edge.strength, 0) / visibleEdges.length).toFixed(2)
      : "0.00";

  return (
    <div className="relative h-[calc(100vh-1rem)] overflow-hidden bg-bg">
      {/* Integrated Control Panel */}
      <div className="absolute left-6 top-6 z-20 flex w-80 flex-col gap-4">
        {/* Mode Toggle & Status */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-border/50 bg-surface/80 p-1.5 shadow-2xl backdrop-blur-xl">
          <button
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              view === "canvas" ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-text-mid hover:text-text-primary"
            }`}
            onClick={() => setView("canvas")}
          >
            Canvas
          </button>
          <button
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              view === "graph" ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-text-mid hover:text-text-primary"
            }`}
            onClick={() => setView("graph")}
          >
            Graph
          </button>
          <div className="h-4 w-[1px] bg-border/50" />
          <button 
            className="group rounded-xl p-2 text-text-muted transition-all hover:bg-surface-2 hover:text-brand" 
            onClick={() => void loadGraph()}
            title="Refresh map"
          >
            <RefreshCw className={`h-4 w-4 transition-transform duration-500 group-active:rotate-180 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-5 rounded-2xl border border-border/50 bg-surface/80 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Knowledge Map</h2>
              <p className="mt-1 text-[13px] font-medium text-text-primary">Manage your view</p>
            </div>
            <button 
              type="button" 
              onClick={resetFilters} 
              className="rounded-lg bg-brand/10 px-2 py-1 text-[10px] font-bold text-brand hover:bg-brand/20 transition-colors"
            >
              RESET
            </button>
          </div>

          <div className="group relative flex items-center gap-2 rounded-xl border border-border/40 bg-bg/50 px-3 py-2.5 transition-all focus-within:border-brand/50 focus-within:ring-2 focus-within:ring-brand/10">
            <Search className="h-4 w-4 text-text-muted group-focus-within:text-brand transition-colors" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, tag, or source..."
              className="w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>

          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted/70">Item Types</div>
            <div className="flex flex-wrap gap-2">
              {allTypes.map((type) => {
                const active = activeTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(type)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                      active
                        ? "border-transparent text-white shadow-md"
                        : "border-border/40 bg-bg/40 text-text-muted hover:border-brand/30 hover:text-text-primary"
                    }`}
                    style={active ? { backgroundColor: typeColors[type], boxShadow: `0 4px 12px ${typeColors[type]}33` } : undefined}
                  >
                    {typeLabels[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowPinnedOnly((current) => !current)}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-3 transition-all ${
                showPinnedOnly
                  ? "border-brand bg-brand/10 text-brand shadow-inner"
                  : "border-border/40 bg-bg/40 text-text-muted hover:border-brand/20 hover:text-text-primary"
              }`}
            >
              {showPinnedOnly ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">Pinned Only</span>
            </button>

            <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-bg/40 p-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
                <span>Strength</span>
                <span className="text-brand">{minStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={minStrength}
                onChange={(event) => setMinStrength(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border/40 accent-brand"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/20 pt-4 text-[11px] font-medium text-text-muted">
            <div className="flex flex-col items-center">
              <span className="text-text-primary">{visibleNodes.length}</span>
              <span>Nodes</span>
            </div>
            <div className="h-6 w-[1px] bg-border/20" />
            <div className="flex flex-col items-center">
              <span className="text-text-primary">{visibleEdges.length}</span>
              <span>Links</span>
            </div>
            <div className="h-6 w-[1px] bg-border/20" />
            <div className="flex flex-col items-center">
              <span className="text-text-primary">{pinnedCount}</span>
              <span>Pinned</span>
            </div>
          </div>
        </div>

        {/* Legend (Collapsible or subtle) */}
        <div className="rounded-2xl border border-border/50 bg-surface/80 p-4 shadow-xl backdrop-blur-xl">
           <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
             <span>Relationship Legend</span>
             <div className="h-2 w-2 rounded-full bg-brand animate-pulse" />
           </div>
           <div className="space-y-2">
             {allTypes.map((type) => (
               <div key={type} className="flex items-center justify-between text-[11px] text-text-mid">
                 <div className="flex items-center gap-2">
                   <div className="h-1.5 w-3 rounded-full" style={{ backgroundColor: typeColors[type] }} />
                   <span>{typeLabels[type]}</span>
                 </div>
                 <span className="font-mono text-[9px] text-text-muted/60">
                   {visibleNodes.filter((node) => node.type === type).length} items
                 </span>
               </div>
             ))}
           </div>
           <p className="mt-4 text-[10px] leading-relaxed text-text-muted/80 bg-bg/30 p-2.5 rounded-lg border border-border/20">
             Drag cards in <span className="text-brand font-semibold">Canvas</span> to organize. Use <span className="text-brand font-semibold">Graph</span> for cluster analysis.
           </p>
        </div>
      </div>

      {loading ? (
        <div className="absolute right-4 top-4 z-20 rounded-buttons border border-border bg-surface px-3 py-2 text-xs text-text-muted">
          Syncing knowledge map...
        </div>
      ) : null}

      {error ? (
        <div className="absolute right-4 top-20 z-20 max-w-sm rounded-buttons border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <div>{error}</div>
          <button type="button" onClick={() => void loadGraph()} className="mt-2 text-xs font-medium text-rose-100">
            Retry
          </button>
        </div>
      ) : null}

      {!loading && visibleNodes.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
          <div className="max-w-md rounded-modals border border-border bg-surface p-6 text-center">
            <h2 className="text-lg font-semibold text-text-primary">No nodes match the current filters</h2>
            <p className="mt-2 text-sm text-text-muted">
              Broaden the search, re-enable a type, or lower the relation threshold to bring the map back.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : view === "canvas" ? (
        <div className="h-full">
          <ReactFlowProvider>
            <ReactFlow
              nodes={visibleFlowNodes}
              edges={flowEdges}
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
            >
              <MiniMap
                nodeStrokeColor={(node) => {
                  const item = (node.data as ItemNodeData | undefined)?.item;
                  return item ? typeColors[item.type] : "#6366f1";
                }}
                nodeColor={() => "#18181b"}
              />
              <Background gap={24} color="rgba(113,113,122,0.18)" />
              <Controls />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      ) : (
        <div className="h-full">
          <ForceGraph2D
            graphData={graphCanvasData}
            backgroundColor="#0f0f11"
            nodeRelSize={7}
            linkColor={() => "rgba(99,102,241,0.35)"}
            linkWidth={(link) => 1 + Number((link as GraphCanvasLink).strength ?? 0) * 2}
            nodeCanvasObject={(node, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const graphNode = node as GraphCanvasNode;
              if (typeof graphNode.x !== "number" || typeof graphNode.y !== "number") {
                return;
              }

              const label = getTitle(graphNode);
              const fontSize = 12 / globalScale;
              const radius = 6;
              
              ctx.save();
              ctx.translate(graphNode.x, graphNode.y);
              
              // Node Glow
              const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 3);
              gradient.addColorStop(0, `${graphNode.nodeTypeColor}33`);
              gradient.addColorStop(1, "transparent");
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(0, 0, radius * 3, 0, 2 * Math.PI);
              ctx.fill();

              // Outer Ring
              ctx.beginPath();
              ctx.arc(0, 0, radius + 2 / globalScale, 0, 2 * Math.PI);
              ctx.strokeStyle = graphNode.color;
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();

              // Core Circle
              ctx.beginPath();
              ctx.arc(0, 0, radius, 0, 2 * Math.PI);
              ctx.fillStyle = graphNode.nodeTypeColor;
              ctx.fill();
              
              // Text Label
              ctx.restore();
              ctx.font = `500 ${fontSize}px "Inter", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              
              // Text Shadow/Background for readability
              const textWidth = ctx.measureText(label).width;
              ctx.fillStyle = "rgba(15, 15, 17, 0.6)";
              ctx.fillRect(graphNode.x - textWidth / 2 - 4, graphNode.y + radius + 4, textWidth + 8, fontSize + 4);
              
              ctx.fillStyle = "#fafafa";
              ctx.fillText(label, graphNode.x, graphNode.y + radius + 6);
            }}
            linkCanvasObjectMode={() => "after"}
            linkCanvasObject={(link, ctx: CanvasRenderingContext2D) => {
              const graphLink = link as GraphCanvasLink;
              const start = graphLink.source;
              const end = graphLink.target;
              if (typeof start === "string" || typeof start === "number" || typeof end === "string" || typeof end === "number") {
                return;
              }
              if (
                !start ||
                !end ||
                typeof start.x !== "number" ||
                typeof start.y !== "number" ||
                typeof end.x !== "number" ||
                typeof end.y !== "number"
              ) {
                return;
              }
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              
              ctx.save();
              ctx.fillStyle = "rgba(161, 161, 170, 0.6)";
              ctx.font = '8px "Geist Mono", monospace';
              ctx.textAlign = "center";
              ctx.fillText(relationLabels[graphLink.relation_type], midX, midY);
              ctx.restore();
            }}
            onNodeClick={(node) => setSelectedId(typeof node.id === "string" ? node.id : null)}
          />
        </div>
      )}

      <ItemDetailModal itemId={selectedId || ""} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-cards border border-border bg-bg px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</div>
      <div className="mt-2 text-xl font-semibold text-text-primary">{value}</div>
    </div>
  );
}
