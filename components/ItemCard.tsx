"use client";

import { useState } from "react";
import { Bell, File, FileText, Link2, MessageSquare, StickyNote, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import ItemDetailModal from "@/components/ItemDetailModal";
import { resolvePreviewImageUrl } from "@/lib/item-preview";

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
}: {
  item: any;
  highlight?: string;
  view?: "grid" | "list";
}) {
  const [open, setOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const typeIcon = {
    url: <Link2 className="h-4 w-4 text-item-link" />,
    text: <MessageSquare className="h-4 w-4 text-item-note" />,
    file: <File className="h-4 w-4 text-item-file" />,
    note: <StickyNote className="h-4 w-4 text-item-note" />,
  }[item.type as string] || <FileText className="h-4 w-4 text-item-note" />;

  const hostLabel = getHostLabel(item.raw_url);
  const previewImageUrl = resolvePreviewImageUrl(item.image_url, item.raw_url);

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
        onClick={() => setOpen(true)}
        className={`relative cursor-pointer rounded-cards border border-border-soft bg-surface transition-all hover:border-brand/40 hover:bg-surface-2 ${
          view === "grid" ? "flex h-full flex-col p-4" : "flex flex-col gap-3 p-4"
        }`}
      >
        {previewImageUrl ? (
          <div className="mb-3 aspect-[1.91/1] overflow-hidden rounded-md">
            <img src={previewImageUrl} alt={item.title || "Preview"} className="h-full w-full object-cover" />
          </div>
        ) : item.type === "url" && item.raw_url ? (
          <div className="mb-3 rounded-cards border border-border bg-bg p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{hostLabel}</div>
                <p className="mt-1 line-clamp-2 text-sm text-text-primary">
                  {item.title || item.raw_url}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-text-mid">
                  {item.summary || item.raw_url}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center rounded-full bg-surface-2 p-1.5">{typeIcon}</span>
          <div className="min-w-0 flex-1 overflow-hidden text-[11px] text-text-muted">
            <span className="truncate">{item.raw_url || sourceLabel[item.source as string] || item.source || "manual"}</span>
            <span className="mx-1">•</span>
            <span suppressHydrationWarning>{new Date(item.created_at).toLocaleDateString()}</span>
          </div>
          {!item.enriched ? <span className="h-2 w-2 animate-pulse rounded-full bg-brand" title="Enriching..." /> : null}
        </div>

        <div className="mt-3">
          {highlight ? <span className="mb-1 block text-xs text-brand">{highlight}</span> : null}
          <h3 className="line-clamp-2 text-sm font-semibold text-text-primary">
            {item.title || item.raw_url || item.file_name || item.raw_text?.slice(0, 100) || "Untitled"}
          </h3>
          {item.summary ? <p className="mt-1 line-clamp-3 text-xs text-text-mid">{item.summary}</p> : null}
          {!item.summary && item.snippet ? <p className="mt-1 line-clamp-3 text-xs text-text-mid">{item.snippet}</p> : null}
        </div>

        {(item.collection_name || item.tags?.length > 0 || item.reminder_at) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.source ? (
              <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] text-text-mid">
                {sourceLabel[item.source as string] || item.source}
              </span>
            ) : null}
            {item.collection_name ? (
              <span className="rounded-full bg-brand/10 px-2 py-1 text-[11px] text-brand">
                {item.collection_name}
              </span>
            ) : null}
            {(item.tags || []).slice(0, 3).map((tag: string) => (
              <span key={tag} className="rounded-full bg-bg px-2 py-1 text-[11px] text-text-muted">
                {tag}
              </span>
            ))}
            {item.reminder_at ? (
              <span className="rounded-full bg-brand/10 px-2 py-1 text-[11px] text-brand" suppressHydrationWarning>
                {new Date(item.reminder_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        ) : null}

        {applied.length > 0 ? (
          <div className="mt-3 rounded-buttons border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-text-primary">
            Applied: {applied.join(" · ")}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                setCommentOpen((current) => !current);
              }}
              className="rounded-buttons px-3 py-2 text-xs text-text-muted hover:bg-bg hover:text-text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comment
              </span>
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                void setReminder();
              }}
              className="rounded-buttons px-3 py-2 text-xs text-text-muted hover:bg-bg hover:text-text-primary"
            >
              <span className="inline-flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Remind
              </span>
            </button>
          </div>
          <button
            onClick={(event) => {
              event.stopPropagation();
              void deleteItem();
            }}
            className="rounded-buttons px-3 py-2 text-xs text-rose-400 hover:bg-bg"
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Delete
            </span>
          </button>
        </div>

        {commentOpen ? (
          <div className="mt-3 border-t border-border pt-3" onClick={(event) => event.stopPropagation()}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Add a comment or action..."
              className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
            />
            <div className="mt-2 flex justify-between gap-2">
              <span className="text-[11px] text-text-muted">Use actions like `folder: work` or `remind me this on 30 Jan`.</span>
              <button
                onClick={addComment}
                disabled={loading || !comment.trim()}
                className="rounded-buttons bg-brand px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        ) : null}
      </article>

      <ItemDetailModal itemId={item.id} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function getHostLabel(url: string | null | undefined) {
  if (!url) return "link";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}
