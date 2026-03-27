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
import "@xyflow/react/dist/style.css";
import { Pin, PinOff, RefreshCw } from "lucide-react";
import ItemDetailModal from "@/components/ItemDetailModal";

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

const collectionColors = ["#38bdf8", "#22c55e", "#f97316", "#e879f9", "#facc15", "#14b8a6"];

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

function ItemNodeCard({ data }: NodeProps<ItemFlowNode>) {
  const item = data.item;

  return (
    <div
      className="w-[260px] rounded-[18px] border border-border bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.18)]"
      style={{
        borderTop: `3px solid ${getCollectionColor(item.collection_id)}`,
        clipPath: "polygon(12px 0%, 100% 0%, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0% 100%, 0% 12px)",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-brand" />
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="mb-1 inline-flex items-center rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white"
              style={{ backgroundColor: typeColors[item.type] }}
            >
              {item.type}
            </div>
            <div className="line-clamp-2 text-sm font-semibold text-text-primary">{getTitle(item)}</div>
          </div>
          <button
            className="rounded-full p-1 text-text-muted hover:bg-surface-2"
            onClick={(event) => {
              event.stopPropagation();
              data.onTogglePinned(item);
            }}
          >
            {item.canvas_pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="line-clamp-3 text-xs text-text-mid">{item.summary || item.raw_url || item.source}</p>
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-bg px-2 py-1 text-[10px] text-text-muted">
              {tag}
            </span>
          ))}
          {!item.enriched ? <span className="rounded-full bg-brand/10 px-2 py-1 text-[10px] text-brand">Enriching</span> : null}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-brand" />
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

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/graph");
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

  const flowEdges = useMemo<Edge[]>(
    () =>
      graphData.edges
        .filter((edge) => edge.strength > 0.75)
        .map((edge) => ({
          id: edge.id,
          source: edge.item_a_id,
          target: edge.item_b_id,
          label: relationLabels[edge.relation_type],
          animated: edge.relation_type === "user_linked",
          style: { stroke: "#6366f1", strokeWidth: 1 + edge.strength * 2 },
          labelStyle: { fill: "#71717a", fontSize: 11 },
        })),
    [graphData.edges],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((current) => applyNodeChanges(changes, current) as ItemFlowNode[]);
  }, []);

  return (
    <div className="relative h-[calc(100vh-1rem)] overflow-hidden bg-bg">
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-modals border border-border bg-surface/90 p-2 backdrop-blur">
        <button
          className={`rounded-buttons px-3 py-2 text-xs ${view === "canvas" ? "bg-brand text-white" : "text-text-mid"}`}
          onClick={() => setView("canvas")}
        >
          Canvas
        </button>
        <button
          className={`rounded-buttons px-3 py-2 text-xs ${view === "graph" ? "bg-brand text-white" : "text-text-mid"}`}
          onClick={() => setView("graph")}
        >
          Graph
        </button>
        <button className="rounded-buttons p-2 text-text-mid hover:bg-surface-2" onClick={() => void loadGraph()}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="absolute right-4 top-4 z-20 rounded-buttons border border-border bg-surface px-3 py-2 text-xs text-text-muted">
          Syncing knowledge map...
        </div>
      ) : null}

      {view === "canvas" ? (
        <div className="h-full">
          <ReactFlowProvider>
            <ReactFlow
              nodes={flowNodes}
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
            graphData={{
              nodes: graphData.nodes.map((node) => ({
                ...node,
                color: getCollectionColor(node.collection_id),
                nodeTypeColor: typeColors[node.type],
              })),
              links: graphData.edges.map((edge) => ({
                ...edge,
                source: edge.item_a_id,
                target: edge.item_b_id,
              })),
            }}
            nodeRelSize={7}
            linkWidth={(link: any) => 1 + Number(link.strength) * 2}
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const label = getTitle(node);
              const fontSize = 11 / globalScale;
              const size = 18;
              ctx.save();
              ctx.translate(node.x, node.y);
              ctx.rotate(Math.PI / 4);
              ctx.beginPath();
              ctx.rect(-size / 2, -size / 2, size, size);
              ctx.fillStyle = node.color;
              ctx.fill();
              ctx.beginPath();
              ctx.arc(0, 0, 4.5, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.nodeTypeColor;
              ctx.fill();
              ctx.restore();
              ctx.font = `600 ${fontSize}px "Geist Mono", monospace`;
              ctx.fillStyle = "#a1a1aa";
              ctx.fillText(label, node.x + 14, node.y + 4);
            }}
            linkCanvasObjectMode={() => "after"}
            linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
              const start = link.source;
              const end = link.target;
              if (!start || !end) return;
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              ctx.fillStyle = "#71717a";
              ctx.font = '10px "Geist Mono", monospace';
              ctx.fillText(relationLabels[link.relation_type as GraphEdgeRecord["relation_type"]], midX, midY);
            }}
            onNodeClick={(node: any) => setSelectedId(node.id)}
          />
        </div>
      )}

      <ItemDetailModal itemId={selectedId || ""} open={!!selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
