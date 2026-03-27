"use client";

import { useEffect, useState } from "react";
import { Calendar, ExternalLink, Link2, MessageSquare, Tag, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import ActionPreview, { type ActionOverrideValue, type ActionPreviewValue } from "@/components/ActionPreview";
import { resolvePreviewImageUrl } from "@/lib/item-preview";

interface ItemDetailModalProps {
  itemId: string;
  open: boolean;
  onClose: () => void;
}

export default function ItemDetailModal({ itemId, open, onClose }: ItemDetailModalProps) {
  const [item, setItem] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [collections, setCollections] = useState<Array<{ id: string; name: string }>>([]);
  const [comment, setComment] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [preview, setPreview] = useState<ActionPreviewValue | null>(null);
  const [overrides, setOverrides] = useState<ActionOverrideValue>({});
  const [loading, setLoading] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftTagsInput, setDraftTagsInput] = useState("");
  const [draftCollectionId, setDraftCollectionId] = useState("");
  const [draftNewCategory, setDraftNewCategory] = useState("");
  const [draftReminderAt, setDraftReminderAt] = useState("");
  const router = useRouter();

  async function load() {
    const [itemRes, commentsRes, collectionsRes] = await Promise.all([
      fetch(`/api/items/${itemId}`),
      fetch(`/api/items/${itemId}/comments`),
      fetch("/api/collections"),
    ]);
    const itemData = await itemRes.json();
    const commentsData = await commentsRes.json();
    const collectionsData = await collectionsRes.json();
    setItem(itemData.item);
    setComments(commentsData.comments || []);
    setCollections(collectionsData.collections || []);
  }

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, itemId]);

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
    setDraftNewCategory("");
    setDraftReminderAt(toLocalDateTimeValue(item.reminder_at));
  }, [item]);

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
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem() {
    const confirmed = window.confirm("Delete this item?");
    if (!confirmed) return;
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    onClose();
    router.refresh();
  }

  async function saveMetadata() {
    if (!item || savingMeta) return;
    setSavingMeta(true);
    try {
      let collectionId: string | null = draftCollectionId || null;

      if (draftNewCategory.trim()) {
        const response = await fetch("/api/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: draftNewCategory.trim() }),
        });
        const data = await response.json();
        collectionId = data.collection?.id || null;
      }

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
          collection_id: collectionId,
          reminder_at: draftReminderAt ? new Date(draftReminderAt).toISOString() : null,
        }),
      });

      await load();
      router.refresh();
    } finally {
      setSavingMeta(false);
    }
  }

  function applyReminderPreset(daysFromNow: number, hour: number, minute = 0) {
    const next = new Date();
    next.setDate(next.getDate() + daysFromNow);
    next.setHours(hour, minute, 0, 0);
    setDraftReminderAt(toLocalDateTimeValue(next.toISOString()));
  }

  const hostLabel = getHostLabel(item?.raw_url);
  const previewImageUrl = resolvePreviewImageUrl(item?.image_url, item?.raw_url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-modals border border-border bg-surface shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{item?.type || "item"}</div>
            <h2 className="text-lg font-semibold text-text-primary">{draftTitle || item?.title || "Untitled"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void deleteItem()} className="rounded-buttons p-2 text-rose-400 hover:bg-surface-2">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="rounded-buttons p-2 text-text-muted hover:bg-surface-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1.5fr_1fr]">
          <div className="min-h-0 overflow-y-auto border-r border-border p-5">
            <div className="space-y-5">
              <section className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Title</div>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Untitled"
                  className="w-full rounded-input border border-border bg-bg px-3 py-3 text-base font-semibold text-text-primary outline-none focus:border-brand"
                />
              </section>

              <section className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Summary</div>
                <textarea
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  rows={4}
                  placeholder="Add a concise summary for this item."
                  className="w-full rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                />
              </section>

              {item?.raw_url ? (
                <section className="rounded-cards border border-border bg-bg p-4">
                  <div className="flex items-start gap-3">
                    {previewImageUrl ? (
                      <img src={previewImageUrl} alt={item.title || "Link preview"} className="h-16 w-24 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-300">
                        <Link2 className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{hostLabel}</div>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-text-primary">
                        {item.title || item.raw_url}
                      </p>
                      <p className="mt-1 line-clamp-3 text-xs text-text-mid">
                        {draftSummary || item.raw_url}
                      </p>
                      <a
                        href={item.raw_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm text-brand hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open source
                      </a>
                    </div>
                  </div>
                </section>
              ) : null}

              {item?.raw_text ? (
                <div className="rounded-cards border border-border bg-bg p-4 text-sm text-text-mid whitespace-pre-wrap">
                  {item.raw_text}
                </div>
              ) : null}

              <section className="grid gap-5 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Tags</div>
                  <input
                    value={draftTagsInput}
                    onChange={(e) => setDraftTagsInput(e.target.value)}
                    placeholder="ai, reading, startup"
                    className="w-full rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                  />
                  <div className="flex flex-wrap gap-2">
                    {draftTagsInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs text-text-mid">
                          <Tag className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Folder</div>
                  <select
                    value={draftCollectionId}
                    onChange={(e) => setDraftCollectionId(e.target.value)}
                    className="w-full rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                  >
                    <option value="">No folder</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={draftNewCategory}
                    onChange={(e) => setDraftNewCategory(e.target.value)}
                    placeholder="Or create a new folder"
                    className="w-full rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                  />
                </div>
              </section>

              <section className="rounded-cards border border-border bg-bg p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Calendar className="h-4 w-4 text-brand" />
                  Reminder
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => applyReminderPreset(0, 18)} className="rounded-full bg-surface-2 px-3 py-2 text-xs text-text-primary">
                    Today 6 PM
                  </button>
                  <button type="button" onClick={() => applyReminderPreset(1, 9)} className="rounded-full bg-surface-2 px-3 py-2 text-xs text-text-primary">
                    Tomorrow 9 AM
                  </button>
                  <button type="button" onClick={() => applyReminderPreset(7, 9)} className="rounded-full bg-surface-2 px-3 py-2 text-xs text-text-primary">
                    Next week 9 AM
                  </button>
                  <button type="button" onClick={() => setDraftReminderAt("")} className="rounded-full bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                    Clear
                  </button>
                </div>
                <div className="mt-3">
                  <input
                    type="datetime-local"
                    value={draftReminderAt}
                    onChange={(e) => setDraftReminderAt(e.target.value)}
                    className="w-full rounded-input border border-border bg-surface px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                  />
                </div>
                {draftReminderAt ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs text-brand">
                    <Calendar className="h-3 w-3" />
                    Reminds at {new Date(draftReminderAt).toLocaleString("en-IN")}
                  </div>
                ) : null}
              </section>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveMetadata}
                  disabled={savingMeta}
                  className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingMeta ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-text-primary">
                <MessageSquare className="h-4 w-4" />
                Comments and actions
              </div>
              <p className="text-xs text-text-muted">
                Try: `remind me this on 30 Jan`, `folder: work`, `tags: ai, reading`
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {applied.length > 0 ? (
                <div className="rounded-buttons border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-text-primary">
                  Applied: {applied.join(" · ")}
                </div>
              ) : null}
              {comments.map((entry) => (
                <div key={entry.id} className="rounded-cards border border-border bg-bg p-3">
                  <p className="text-sm text-text-primary">{entry.body}</p>
                  <p className="mt-2 text-xs text-text-muted">{new Date(entry.created_at).toLocaleString("en-IN")}</p>
                </div>
              ))}
              {comments.length === 0 ? <p className="text-sm text-text-muted">No comments yet.</p> : null}
            </div>
            <div className="shrink-0 border-t border-border bg-surface p-4">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Add a comment or action..."
                className="w-full rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
              />
              {preview ? <div className="mt-3"><ActionPreview preview={preview} overrides={overrides} onChange={setOverrides} /></div> : null}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleCommentSubmit}
                  disabled={loading || !comment.trim()}
                  className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Add comment"}
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
