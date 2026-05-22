"use client";

import { useState } from "react";
import { Bell, CheckSquare2, MessageSquare, Square, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { resolvePreviewImageUrl } from "@/lib/item-preview";
import type { ArchiveItem } from "@/lib/types";

const sourceLabel: Record<string, string> = {
  telegram: "Telegram",
  "pwa-share": "Shared",
  email: "Email",
  web: "Web",
  manual: "Manual",
  extension: "Extension",
  mobile: "Mobile",
};

const typeLabel: Record<string, string> = {
  url: "Link",
  text: "Text",
  file: "File",
  note: "Note",
};

// Image-led card. Modal ownership lifted to the Feed parent so the same
// detail modal can be opened by mouse OR keyboard. Card click invokes
// `onOpen(item.id)`; the comment popover stays local to the card.

export default function ItemCard({
  item,
  index,
  highlight,
  focused = false,
  selectionMode = false,
  selected = false,
  onOpen,
  onToggleSelect,
}: {
  item: ArchiveItem;
  index?: number;
  highlight?: string;
  focused?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onOpen?: (itemId: string) => void;
  onToggleSelect?: (itemId: string) => void;
}) {
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const router = useRouter();

  const hostLabel = getHostLabel(item.raw_url);
  const previewImageUrl = resolvePreviewImageUrl(item.image_url, item.raw_url);
  const sourceMeta = sourceLabel[item.source as string] || item.source || "manual";
  const meta = item.raw_url ? hostLabel : sourceMeta;
  const typeName = typeLabel[item.type as string] || "Item";

  const title =
    item.title || item.raw_url || item.file_name || item.raw_text?.slice(0, 140) || "Untitled";
  const body = item.summary || item.snippet || (item.raw_url ? null : item.raw_text);

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
    if (!deletePending) {
      setDeletePending(true);
      return;
    }
    setDeletePending(false);
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <article
      data-feed-index={index}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect?.(item.id);
          return;
        }
        onOpen?.(item.id);
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-cards border bg-surface transition-all ${
        selected
          ? "border-brand ring-2 ring-brand/30"
          : focused
            ? "border-brand/50 ring-2 ring-brand/20"
            : "border-border-soft hover:border-border hover:shadow-lg hover:shadow-black/20"
      }`}
    >
      {selectionMode ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item.id);
          }}
          className={`absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur ${
            selected
              ? "border-brand bg-brand text-white"
              : "border-border bg-surface/90 text-text-muted"
          }`}
          aria-label={selected ? "Deselect item" : "Select item"}
        >
          {selected ? <CheckSquare2 className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
      ) : null}

      {previewImageUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-2">
          <Image
            src={previewImageUrl}
            alt={item.title || "Preview"}
            fill
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            unoptimized
            {...(item.blur_data_url
              ? { placeholder: "blur" as const, blurDataURL: item.blur_data_url }
              : {})}
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur">
              {typeName}
            </span>
            <span className="truncate rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
              {meta}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 p-5">
        {highlight ? (
          <span className="text-[11px] uppercase tracking-wider text-brand">{highlight}</span>
        ) : null}

        {!previewImageUrl ? (
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-text-mid">{typeName}</span>
            <span className="truncate normal-case text-text-muted">{meta}</span>
          </div>
        ) : null}

        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-text-primary">
          {title}
        </h3>

        {body ? (
          <p className="line-clamp-3 text-sm leading-relaxed text-text-mid">{body}</p>
        ) : null}

        {item.collection_name || (item.tags?.length ?? 0) > 0 || item.reminder_at ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {item.collection_name ? (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">
                {item.collection_name}
              </span>
            ) : null}
            {(item.tags || []).slice(0, 5).map((tag: string) => (
              <span
                key={tag}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted"
              >
                #{tag}
              </span>
            ))}
            {item.reminder_at ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300"
                suppressHydrationWarning
              >
                <Bell className="h-2.5 w-2.5" />
                {new Date(item.reminder_at).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-1 text-[11px] text-text-muted">
          <span suppressHydrationWarning>
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year:
                new Date(item.created_at).getFullYear() === new Date().getFullYear()
                  ? undefined
                  : "numeric",
            })}
          </span>
          {!item.enriched ? (
            <span className="inline-flex items-center gap-1.5 text-brand">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Enriching…
            </span>
          ) : null}
        </div>

        {applied.length > 0 ? (
          <div className="rounded-buttons bg-brand/10 px-3 py-1.5 text-[11px] text-brand">
            Applied: {applied.join(" · ")}
          </div>
        ) : null}
      </div>

      {!selectionMode ? (
        <div
          className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {deletePending ? (
            <>
              <button
                onClick={() => setDeletePending(false)}
                className="rounded-buttons border border-border bg-surface/95 px-2.5 py-1.5 text-[11px] text-text-mid backdrop-blur hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteItem();
                }}
                className="rounded-buttons border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-300 backdrop-blur hover:bg-rose-500/20"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCommentOpen((c) => !c);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface/95 text-text-muted backdrop-blur hover:text-text-primary"
                aria-label="Comment on item"
                title="Comment"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void setReminder();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface/95 text-text-muted backdrop-blur hover:text-text-primary"
                aria-label="Set reminder"
                title="Remind me tomorrow (r)"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteItem();
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface/95 text-text-muted backdrop-blur hover:text-rose-400"
                aria-label="Delete item"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ) : null}

      {commentOpen ? (
        <div
          className="border-t border-border bg-bg p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Add a comment or action…"
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted">
              Try `folder: work`, `#design`, or `remind me on 30 Jan`.
            </span>
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
