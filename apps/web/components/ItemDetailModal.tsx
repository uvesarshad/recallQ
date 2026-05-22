"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, ExternalLink, MessageSquare, Tag, Trash2, X } from "lucide-react";
import Image from "next/image";
import ActionPreview, { type ActionOverrideValue, type ActionPreviewValue } from "@/components/ActionPreview";
import { dispatchArchiveItemsChanged } from "@/lib/archive-events";
import { resolvePreviewImageUrl } from "@/lib/item-preview";
import { useModalA11y } from "@/lib/use-modal-a11y";
import type { ArchiveComment, ArchiveItem, CollectionRecord } from "@/lib/types";

// Image-led detail modal that matches the new Feed card visual language.
// Left pane: preview image (when present) → title → summary → source link →
// editable metadata (tags, folder, reminder) → save. Right pane: comments
// thread + action composer. Mobile collapses to a single scroll column.

interface ItemDetailModalProps {
  itemId: string;
  open: boolean;
  onClose: () => void;
}

const REMINDER_PRESETS: Array<{ label: string; days: number; hour: number }> = [
  { label: "Today 6 PM", days: 0, hour: 18 },
  { label: "Tomorrow 9 AM", days: 1, hour: 9 },
  { label: "Next week", days: 7, hour: 9 },
];

export default function ItemDetailModal({ itemId, open, onClose }: ItemDetailModalProps) {
  const [item, setItem] = useState<ArchiveItem | null>(null);
  const [comments, setComments] = useState<ArchiveComment[]>([]);
  const [collections, setCollections] = useState<Array<Pick<CollectionRecord, "id" | "name">>>([]);
  const [comment, setComment] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [preview, setPreview] = useState<ActionPreviewValue | null>(null);
  const [overrides, setOverrides] = useState<ActionOverrideValue>({});
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftTagsInput, setDraftTagsInput] = useState("");
  const [draftCollectionId, setDraftCollectionId] = useState("");
  const [draftReminderAt, setDraftReminderAt] = useState("");

  const load = useCallback(async () => {
    const [itemRes, commentsRes, collectionsRes] = await Promise.all([
      fetch(`/api/items/${itemId}`),
      fetch(`/api/items/${itemId}/comments`),
      fetch("/api/collections"),
    ]);
    const itemData = (await itemRes.json()) as { item?: ArchiveItem | null };
    const commentsData = (await commentsRes.json()) as { comments?: ArchiveComment[] };
    const collectionsData = (await collectionsRes.json()) as {
      collections?: Array<Pick<CollectionRecord, "id" | "name">>;
    };
    setItem(itemData.item ?? null);
    setComments(commentsData.comments || []);
    setCollections(collectionsData.collections || []);
  }, [itemId]);

  useEffect(() => {
    if (open && itemId) void load();
  }, [load, open, itemId]);

  // Debounced action preview as the user types in the comment box. Matches
  // the inline preview shown in the Capture dialog so command syntax feels
  // consistent across surfaces.
  useEffect(() => {
    if (!open || !comment.trim()) {
      setPreview(null);
      setOverrides({});
      return;
    }
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/actions/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: comment }),
        });
        const data = await response.json();
        setPreview(data.preview || null);
      } catch {
        setPreview(null);
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [comment, open]);

  useEffect(() => {
    if (!item) return;
    setDraftTitle(item.title || "");
    setDraftSummary(item.summary || "");
    setDraftTagsInput((item.tags || []).join(", "));
    setDraftCollectionId(item.collection_id || "");
    setDraftReminderAt(toLocalDateTimeValue(item.reminder_at));
  }, [item]);

  useEffect(() => {
    if (!open) return;
    function handler(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open]);

  const containerRef = useModalA11y(open);

  if (!open) return null;

  async function handleCommentSubmit() {
    if (!comment.trim() || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/items/${itemId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: comment, actionOverrides: overrides }),
      });
      const data = await response.json();
      setApplied(data.applied || []);
      setComment("");
      setPreview(null);
      setOverrides({});
      await load();
      dispatchArchiveItemsChanged();
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem() {
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    dispatchArchiveItemsChanged();
    onClose();
  }

  async function saveMetadata() {
    if (!item || savingMeta) return;
    setSavingMeta(true);
    try {
      const tags = draftTagsInput
        .split(",")
        .map((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"))
        .filter(Boolean);

      await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim() || item.title || "",
          summary: draftSummary.trim() || null,
          tags: Array.from(new Set(tags)),
          collection_id: draftCollectionId || null,
          reminder_at: draftReminderAt ? new Date(draftReminderAt).toISOString() : null,
        }),
      });

      await load();
      dispatchArchiveItemsChanged();
    } finally {
      setSavingMeta(false);
    }
  }

  function applyReminderPreset(daysFromNow: number, hour: number) {
    const next = new Date();
    next.setDate(next.getDate() + daysFromNow);
    next.setHours(hour, 0, 0, 0);
    setDraftReminderAt(toLocalDateTimeValue(next.toISOString()));
  }

  const hostLabel = getHostLabel(item?.raw_url);
  const previewImageUrl = resolvePreviewImageUrl(item?.image_url, item?.raw_url);
  const typeLabel = (item?.type ?? "item").toUpperCase();
  const dirtyMeta =
    !!item &&
    (draftTitle !== (item.title ?? "") ||
      draftSummary !== (item.summary ?? "") ||
      draftTagsInput !== (item.tags ?? []).join(", ") ||
      draftCollectionId !== (item.collection_id ?? "") ||
      draftReminderAt !== toLocalDateTimeValue(item.reminder_at));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setDeletePending(false);
          onClose();
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-modals border border-border bg-surface shadow-2xl"
      >
        {/* Floating close button — sits above the image so the chrome stays
            minimal at the top. */}
        <button
          aria-label="Close"
          onClick={() => {
            setDeletePending(false);
            onClose();
          }}
          className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/80 text-text-muted backdrop-blur transition hover:bg-surface hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>

        {deletePending ? (
          <div className="flex items-center justify-between gap-4 border-b border-rose-500/30 bg-rose-500/10 px-5 py-3">
            <p className="text-sm text-rose-300">Permanently delete this item? This cannot be undone.</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setDeletePending(false)}
                className="rounded-buttons border border-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteItem()}
                className="rounded-buttons bg-rose-600 px-3 py-1.5 text-sm font-medium text-white"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1.6fr_1fr]">
          {/* Left pane: image + title + summary + metadata editor */}
          <div className="min-h-0 overflow-y-auto lg:border-r lg:border-border">
            {previewImageUrl ? (
              <div className="relative aspect-[2.2/1] w-full overflow-hidden bg-surface-2">
                <Image
                  src={previewImageUrl}
                  alt={item?.title || "Preview"}
                  fill
                  sizes="(min-width: 1024px) 720px, 100vw"
                  className="object-cover"
                  unoptimized
                  {...(item?.blur_data_url
                    ? { placeholder: "blur" as const, blurDataURL: item.blur_data_url }
                    : {})}
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-5 flex items-center gap-2">
                  <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur">
                    {typeLabel}
                  </span>
                  {hostLabel !== "link" ? (
                    <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white backdrop-blur">
                      {hostLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="border-b border-border bg-surface px-6 py-4">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-text-muted">
                  {typeLabel}
                </span>
              </div>
            )}

            <div className="space-y-6 px-6 py-6">
              <section className="space-y-2">
                <h2 id="item-detail-title" className="sr-only">
                  Item detail
                </h2>
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="Untitled"
                  aria-label="Item title"
                  className="w-full bg-transparent text-2xl font-semibold leading-tight tracking-tight text-text-primary outline-none placeholder:text-text-muted"
                />
                {item?.raw_url ? (
                  <a
                    href={item.raw_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="truncate">{item.raw_url}</span>
                  </a>
                ) : null}
              </section>

              <section className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Summary</div>
                <textarea
                  value={draftSummary}
                  onChange={(event) => setDraftSummary(event.target.value)}
                  rows={4}
                  placeholder="Add a concise summary for this item."
                  aria-label="Item summary"
                  className="w-full rounded-input border border-border bg-bg px-3 py-3 text-sm leading-relaxed text-text-primary outline-none focus:border-brand"
                />
              </section>

              {item?.raw_text && !item?.raw_url ? (
                <section className="rounded-cards border border-border bg-bg p-4 text-sm leading-relaxed text-text-mid whitespace-pre-wrap">
                  {item.raw_text}
                </section>
              ) : null}

              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Tags</div>
                  <input
                    value={draftTagsInput}
                    onChange={(event) => setDraftTagsInput(event.target.value)}
                    placeholder="ai, reading, startup"
                    aria-label="Tags, comma-separated"
                    className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {draftTagsInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-text-mid"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Folder</div>
                  <select
                    value={draftCollectionId}
                    onChange={(event) => setDraftCollectionId(event.target.value)}
                    aria-label="Assign to folder"
                    className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                  >
                    <option value="">No folder</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-text-muted">
                    Manage folders in Settings → Folders.
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-cards border border-border bg-bg p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Calendar className="h-4 w-4 text-brand" />
                  Reminder
                </div>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_PRESETS.map(({ label, days, hour }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => applyReminderPreset(days, hour)}
                      className="rounded-full bg-surface-2 px-3 py-1.5 text-xs text-text-primary hover:bg-surface"
                    >
                      {label}
                    </button>
                  ))}
                  {draftReminderAt ? (
                    <button
                      type="button"
                      onClick={() => setDraftReminderAt("")}
                      className="rounded-full bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <input
                  type="datetime-local"
                  value={draftReminderAt}
                  onChange={(event) => setDraftReminderAt(event.target.value)}
                  className="w-full rounded-input border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
                />
                {draftReminderAt ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs text-brand">
                    <Calendar className="h-3 w-3" />
                    Reminds at {new Date(draftReminderAt).toLocaleString()}
                  </div>
                ) : null}
              </section>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletePending(true)}
                  className="inline-flex items-center gap-1.5 rounded-buttons border border-border bg-surface px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete item
                </button>
                <button
                  type="button"
                  onClick={saveMetadata}
                  disabled={savingMeta || !dirtyMeta}
                  className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingMeta ? "Saving…" : dirtyMeta ? "Save changes" : "Saved"}
                </button>
              </div>
            </div>
          </div>

          {/* Right pane: comments thread + action composer. On mobile this
              stacks below the left pane within the same scroll container. */}
          <div className="flex min-h-0 flex-col overflow-hidden border-t border-border lg:border-t-0">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <MessageSquare className="h-4 w-4" />
                Comments &amp; actions
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Try `remind me on 30 Jan`, `folder: work`, or `#ai`.
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {applied.length > 0 ? (
                <div className="rounded-buttons border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-text-primary">
                  Applied: {applied.join(" · ")}
                </div>
              ) : null}
              {comments.length === 0 ? (
                <p className="text-sm text-text-muted">No comments yet.</p>
              ) : (
                comments.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-cards border border-border bg-bg p-3"
                  >
                    <p className="text-sm leading-relaxed text-text-primary">{entry.body}</p>
                    <p className="mt-2 text-[11px] text-text-muted" suppressHydrationWarning>
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="shrink-0 border-t border-border bg-surface px-5 py-4">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={3}
                placeholder="Add a comment or action…"
                className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand"
              />
              {preview ? (
                <div className="mt-3">
                  <ActionPreview preview={preview} overrides={overrides} onChange={setOverrides} />
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleCommentSubmit}
                  disabled={loading || !comment.trim()}
                  className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? "Saving…" : "Add comment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function toLocalDateTimeValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function getHostLabel(url: string | null | undefined) {
  if (!url) return "link";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}
