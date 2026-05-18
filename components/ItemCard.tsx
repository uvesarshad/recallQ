"use client";

import { useState } from "react";
import { Bell, CheckSquare2, File, FileText, Link2, MessageSquare, Square, StickyNote, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ItemDetailModal from "@/components/ItemDetailModal";
import { resolvePreviewImageUrl } from "@/lib/item-preview";
import type { ArchiveItem } from "@/lib/types";

const sourceLabel: Record<string, string> = {
  telegram: "Telegram",
  "pwa-share": "Shared",
  email: "Email",
  web: "Web",
  manual: "Manual",
  extension: "Extension",
};

export default function ItemCard({
  item,
  highlight,
  view = "list",
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  item: ArchiveItem;
  highlight?: string;
  view?: "grid" | "list";
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (itemId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const typeIcon = {
    url: <Link2 className="h-3.5 w-3.5 text-item-link" />,
    text: <MessageSquare className="h-3.5 w-3.5 text-item-note" />,
    file: <File className="h-3.5 w-3.5 text-item-file" />,
    note: <StickyNote className="h-3.5 w-3.5 text-item-note" />,
  }[item.type as string] || <FileText className="h-3.5 w-3.5 text-item-note" />;

  const hostLabel = getHostLabel(item.raw_url);
  const previewImageUrl = resolvePreviewImageUrl(item.image_url, item.raw_url);
  const metaLabel = item.raw_url ? hostLabel : (sourceLabel[item.source as string] || item.source || "manual");

  async function setReminder() {
    const remindAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    remindAt.setHours(9, 0, 0, 0);
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminder_at: remindAt.toISOString() }),
    });
    router.refresh();
  }

  async function addComment() {
    if (!comment.trim() || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/items/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment }),
      });
      const data = await response.json();
      setApplied(data.applied || []);
      setComment("");
      setCommentOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem() {
    const confirmed = window.confirm("Delete this item?");
    if (!confirmed) return;
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <article
        onClick={() => {
          if (selectionMode) { onToggleSelect?.(item.id); return; }
          setOpen(true);
        }}
        className={`group relative cursor-pointer rounded-cards border bg-surface transition-colors ${
          selected
            ? "border-brand ring-1 ring-brand/30"
            : "border-border-soft hover:border-border"
        } ${view === "grid" ? "flex h-full flex-col p-4" : "flex flex-col p-4"}`}
      >
        {/* Selection checkbox */}
        {selectionMode ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item.id); }}
            className={`absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border ${
              selected ? "border-brand bg-brand text-white" : "border-border bg-surface text-text-muted"
            }`}
            aria-label={selected ? "Deselect item" : "Select item"}
          >
            {selected ? <CheckSquare2 className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          </button>
        ) : null}

        {/* Preview image */}
        {previewImageUrl ? (
          <div className="mb-3 aspect-[1.91/1] overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImageUrl} alt={item.title || "Preview"} className="h-full w-full object-cover" />
          </div>
        ) : null}

        {/* Meta row */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
          {typeIcon}
          <span className="truncate">{metaLabel}</span>
          <span className="text-text-muted/40">·</span>
          <span suppressHydrationWarning className="shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
          {!item.enriched ? <span className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-brand" title="Enriching…" /> : null}
        </div>

        {/* Title + summary */}
        <div className="mt-2">
          {highlight ? <span className="mb-1 block text-[11px] text-brand">{highlight}</span> : null}
          <h3 className="line-clamp-2 text-sm font-medium text-text-primary">
            {item.title || item.raw_url || item.file_name || item.raw_text?.slice(0, 100) || "Untitled"}
          </h3>
          {item.summary ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{item.summary}</p>
          ) : !item.summary && item.snippet ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{item.snippet}</p>
          ) : null}
        </div>

        {/* Tags / folder / reminder */}
        {(item.collection_name || (item.tags?.length ?? 0) > 0 || item.reminder_at) ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.collection_name ? (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">{item.collection_name}</span>
            ) : null}
            {(item.tags || []).slice(0, 4).map((tag: string) => (
              <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted">#{tag}</span>
            ))}
            {item.reminder_at ? (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand" suppressHydrationWarning>
                <Bell className="mr-1 inline h-2.5 w-2.5" />{new Date(item.reminder_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        ) : null}

        {applied.length > 0 ? (
          <div className="mt-2 text-[11px] text-brand">Applied: {applied.join(" · ")}</div>
        ) : null}

        {/* Hover-reveal actions */}
        {!selectionMode ? (
          <div className="mt-3 flex items-center justify-between gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setCommentOpen((c) => !c); }}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text-primary"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Comment
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); void setReminder(); }}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-text-primary"
              >
                <Bell className="h-3.5 w-3.5" /> Remind
              </button>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); void deleteItem(); }}
              className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-text-muted hover:bg-surface-2 hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {/* Comment form */}
        {commentOpen ? (
          <div className="mt-3 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Add a comment or action…"
              className="w-full rounded-input border border-border bg-bg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-muted">Use actions like `folder: work` or `remind me on 30 Jan`.</span>
              <button
                onClick={addComment}
                disabled={loading || !comment.trim()}
                className="rounded-buttons bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : null}
      </article>

      {!selectionMode ? <ItemDetailModal itemId={item.id} open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function getHostLabel(url: string | null | undefined) {
  if (!url) return "link";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "link"; }
}
