"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Bookmark,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Heart,
  Highlighter,
  MessageSquare,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import ActionPreview, { type ActionOverrideValue, type ActionPreviewValue } from "@/components/ActionPreview";
import { dispatchArchiveItemsChanged } from "@/lib/archive-events";
import { resolvePreviewImageUrl } from "@/lib/item-preview";
import { useModalA11y } from "@/lib/use-modal-a11y";
import type { ArchiveComment, ArchiveItem, CollectionRecord, ItemHighlight } from "@/lib/types";

// Glassmorphism detail modal. Preserves all existing logic, API calls, and
// behaviour — only the visual presentation has changed.

// Design tokens
const T = {
  ink: "#0B1220",
  inkSoft: "#5A6478",
  inkFaint: "#9AA4B8",
  azure: "#3D7DFF",
  azureDeep: "#2B5FD9",
  mint: "#22C9A8",
  glass: "rgba(255,255,255,0.55)",
  glassEdge: "rgba(255,255,255,0.75)",
  line: "rgba(11,18,32,0.07)",
  shadowLift: "0 18px 50px rgba(17,34,68,0.16)",
} as const;

const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', monospace";

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

type ReaderPayload = {
  reader?: {
    text?: string | null;
    source?: "archive" | "item" | "summary" | "none";
  };
};

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
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerText, setReaderText] = useState<string | null>(null);
  const [readerSource, setReaderSource] = useState<string>("none");
  const [stateLoading, setStateLoading] = useState(false);
  const [highlights, setHighlights] = useState<ItemHighlight[]>([]);
  const [highlightQuote, setHighlightQuote] = useState("");
  const [highlightNote, setHighlightNote] = useState("");
  const [highlightColor, setHighlightColor] = useState<ItemHighlight["color"]>("yellow");
  const [highlightLoading, setHighlightLoading] = useState(false);

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

  useEffect(() => {
    if (!open) {
      setReaderOpen(false);
      setReaderText(null);
      setHighlights([]);
      setHighlightQuote("");
      setHighlightNote("");
      setHighlightColor("yellow");
    }
  }, [open]);

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

  async function requestArchive() {
    if (!item?.raw_url || archiveLoading) return;
    setArchiveLoading(true);
    try {
      await fetch(`/api/items/${itemId}/archive`, { method: "POST" });
      await load();
      dispatchArchiveItemsChanged();
    } finally {
      setArchiveLoading(false);
    }
  }

  async function loadReader() {
    if (!itemId || readerLoading) return;
    setReaderLoading(true);
    try {
      const [readerRes, highlightsRes] = await Promise.all([
        fetch(`/api/items/${itemId}/reader`),
        fetch(`/api/items/${itemId}/highlights`),
      ]);
      const readerData = (await readerRes.json()) as ReaderPayload;
      const highlightsData = (await highlightsRes.json()) as { highlights?: ItemHighlight[] };
      setReaderText(readerData.reader?.text ?? null);
      setReaderSource(readerData.reader?.source ?? "none");
      setHighlights(highlightsData.highlights ?? []);
      setReaderOpen(true);
    } finally {
      setReaderLoading(false);
    }
  }

  async function saveReaderState(update: Partial<ArchiveItem>) {
    if (!item || stateLoading) return;
    setStateLoading(true);
    try {
      const response = await fetch(`/api/items/${itemId}/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = (await response.json()) as { item?: Partial<ArchiveItem> };
      if (data.item) {
        setItem((current) => (current ? { ...current, ...data.item } : current));
        dispatchArchiveItemsChanged();
      }
    } finally {
      setStateLoading(false);
    }
  }

  async function createHighlight() {
    if (!highlightQuote.trim() || highlightLoading) return;
    setHighlightLoading(true);
    try {
      const response = await fetch(`/api/items/${itemId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote: highlightQuote,
          note: highlightNote.trim() || null,
          color: highlightColor,
        }),
      });
      const data = (await response.json()) as { highlight?: ItemHighlight };
      if (data.highlight) {
        setHighlights((current) => [data.highlight!, ...current]);
        setHighlightQuote("");
        setHighlightNote("");
      }
    } finally {
      setHighlightLoading(false);
    }
  }

  async function deleteHighlight(highlightId: string) {
    await fetch(`/api/items/${itemId}/highlights/${highlightId}`, { method: "DELETE" });
    setHighlights((current) => current.filter((entry) => entry.id !== highlightId));
  }

  async function markLinkFalsePositive() {
    if (!item?.link_broken || stateLoading) return;
    setStateLoading(true);
    try {
      const response = await fetch(`/api/items/${itemId}/link-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "false_positive" }),
      });
      const data = (await response.json()) as { item?: Partial<ArchiveItem> };
      if (data.item) {
        setItem((current) => (current ? { ...current, ...data.item } : current));
        dispatchArchiveItemsChanged();
      }
    } finally {
      setStateLoading(false);
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

  const parsedTags = draftTagsInput
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return (
    // Overlay
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setDeletePending(false);
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        background: "rgba(11,18,32,.28)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: 18,
        animation: "fadeIn .25s ease",
      }}
    >
      {/* Modal box */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 540,
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 24,
          background: "rgba(255,255,255,.82)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          border: `1px solid ${T.glassEdge}`,
          boxShadow: T.shadowLift,
          animation: "popIn .35s cubic-bezier(.2,1.1,.3,1)",
        }}
      >
        {/* Delete confirmation banner */}
        {deletePending ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              borderBottom: "1px solid rgba(239,68,68,.3)",
              background: "rgba(239,68,68,.08)",
              padding: "12px 20px",
              borderRadius: "24px 24px 0 0",
            }}
          >
            <p style={{ fontFamily: FONT, fontSize: 13, color: "#dc2626", margin: 0 }}>
              Permanently delete this item? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setDeletePending(false)}
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: `1px solid ${T.line}`,
                  background: "rgba(255,255,255,.6)",
                  color: T.ink,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteItem()}
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}

        {/* Preview image */}
        {previewImageUrl ? (
          <div
            style={{
              height: 170,
              position: "relative",
              overflow: "hidden",
              borderRadius: deletePending ? "0" : "24px 24px 0 0",
              background: "#e2e8f0",
            }}
          >
            <Image
              src={previewImageUrl}
              alt={item?.title || "Preview"}
              fill
              sizes="540px"
              style={{ objectFit: "cover" }}
              unoptimized
              {...(item?.blur_data_url
                ? { placeholder: "blur" as const, blurDataURL: item.blur_data_url }
                : {})}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to top, rgba(11,18,32,.55) 0%, transparent 55%)",
              }}
            />
          </div>
        ) : null}

        {/* Main content */}
        <div style={{ padding: 22 }}>
          {/* Header row: type icon + source label + X close */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11.5,
                color: T.inkFaint,
                flex: 1,
                letterSpacing: ".04em",
              }}
            >
              {typeLabel}
              {hostLabel && hostLabel !== "link" ? ` · ${hostLabel}` : ""}
            </span>
            {/* Close button */}
            <button
              aria-label="Close"
              onClick={() => {
                setDeletePending(false);
                onClose();
              }}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: `1px solid ${T.glassEdge}`,
                background: "rgba(255,255,255,.6)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: T.inkSoft,
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Title */}
          <h2
            id="item-detail-title"
            style={{
              fontFamily: FONT,
              fontSize: 21,
              fontWeight: 700,
              color: T.ink,
              lineHeight: 1.25,
              margin: "0 0 6px 0",
            }}
          >
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Untitled"
              aria-label="Item title"
              style={{
                width: "100%",
                fontFamily: FONT,
                fontSize: 21,
                fontWeight: 700,
                color: T.ink,
                lineHeight: 1.25,
                background: "transparent",
                border: "none",
                outline: "none",
                padding: 0,
              }}
            />
          </h2>

          {/* URL or raw text */}
          {item?.raw_url ? (
            <>
              <a
                href={item.raw_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: MONO,
                  fontSize: 12.5,
                  color: T.azure,
                  textDecoration: "none",
                  marginBottom: 10,
                }}
              >
                <ExternalLink size={12} />
                <span
                  style={{
                    maxWidth: 420,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                >
                  {item.raw_url}
                </span>
              </a>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 16,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${item.link_broken ? "rgba(220,38,38,.2)" : T.line}`,
                  background: item.link_broken ? "rgba(239,68,68,.07)" : "rgba(255,255,255,.45)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  {item.link_broken ? (
                    <AlertTriangle size={15} color="#dc2626" />
                  ) : (
                    <Archive size={15} color={T.azure} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: T.ink, margin: 0 }}>
                      {archiveStatusLabel(item.archive_status)}
                    </p>
                    <p style={{ fontFamily: FONT, fontSize: 11.5, color: item.link_broken ? "#dc2626" : T.inkFaint, margin: "2px 0 0 0" }}>
                      {archiveStatusDetail(item)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void requestArchive()}
                  disabled={archiveLoading || item.archive_status === "pending" || item.archive_status === "processing"}
                  style={{
                    flexShrink: 0,
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    background: archiveLoading ? "rgba(61,125,255,.45)" : T.azure,
                    border: "none",
                    borderRadius: 10,
                    padding: "7px 11px",
                    cursor:
                      archiveLoading || item.archive_status === "pending" || item.archive_status === "processing"
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {archiveLoading
                    ? "Queued"
                    : item.archive_status === "available"
                      ? "Re-archive"
                      : item.archive_status === "failed"
                        ? "Retry"
                        : item.archive_status === "pending" || item.archive_status === "processing"
                          ? "Queued"
                          : "Archive"}
                </button>
                {item.link_broken ? (
                  <button
                    type="button"
                    onClick={() => void markLinkFalsePositive()}
                    disabled={stateLoading}
                    style={{
                      flexShrink: 0,
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#dc2626",
                      background: "rgba(239,68,68,.07)",
                      border: "1px solid rgba(220,38,38,.18)",
                      borderRadius: 10,
                      padding: "7px 11px",
                      cursor: stateLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    Mark OK
                  </button>
                ) : null}
              </div>
            </>
          ) : item?.raw_text ? (
            <p
              style={{
                fontFamily: FONT,
                fontSize: 13,
                color: T.inkSoft,
                lineHeight: 1.6,
                marginBottom: 16,
                whiteSpace: "pre-wrap",
              }}
            >
              {item.raw_text}
            </p>
          ) : null}

          {item ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "rgba(255,255,255,.48)",
                border: `1px solid ${T.line}`,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void saveReaderState({ is_favorite: !item.is_favorite })}
                  disabled={stateLoading}
                  style={readerToggleStyle(Boolean(item.is_favorite), "#dc2626")}
                >
                  <Heart size={13} fill={item.is_favorite ? "#dc2626" : "none"} />
                  Favorite
                </button>
                <button
                  type="button"
                  onClick={() => void saveReaderState({ is_read_later: !item.is_read_later })}
                  disabled={stateLoading}
                  style={readerToggleStyle(Boolean(item.is_read_later), T.azure)}
                >
                  <Bookmark size={13} fill={item.is_read_later ? T.azure : "none"} />
                  Read later
                </button>
                <button
                  type="button"
                  onClick={() => void saveReaderState({ is_archived: !item.is_archived })}
                  disabled={stateLoading}
                  style={readerToggleStyle(Boolean(item.is_archived), T.mint)}
                >
                  <Archive size={13} />
                  Archived
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void saveReaderState({
                      reading_state: item.reading_state === "read" ? "reading" : "read",
                      reading_progress: item.reading_state === "read" ? 50 : 100,
                    })
                  }
                  disabled={stateLoading}
                  style={readerToggleStyle(item.reading_state === "read", "#0E9E83")}
                >
                  <CheckCircle2 size={13} />
                  Read
                </button>
                <button
                  type="button"
                  onClick={() => (readerOpen ? setReaderOpen(false) : void loadReader())}
                  disabled={readerLoading}
                  style={{
                    marginLeft: "auto",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                    background: T.ink,
                    border: "none",
                    borderRadius: 10,
                    padding: "7px 11px",
                    cursor: readerLoading ? "not-allowed" : "pointer",
                  }}
                >
                  <BookOpen size={13} />
                  {readerLoading ? "Loading" : readerOpen ? "Hide reader" : "Reader"}
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: ".08em" }}>
                    Progress
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: T.inkFaint }}>
                    {item.reading_state ?? "unread"} · {item.reading_progress ?? 0}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={item.reading_progress ?? 0}
                  onChange={(event) =>
                    setItem((current) =>
                      current
                        ? {
                            ...current,
                            reading_progress: Number(event.target.value),
                            reading_state:
                              Number(event.target.value) >= 100
                                ? "read"
                                : Number(event.target.value) > 0
                                  ? "reading"
                                  : "unread",
                          }
                        : current,
                    )
                  }
                  onMouseUp={(event) =>
                    void saveReaderState({ reading_progress: Number(event.currentTarget.value) })
                  }
                  onTouchEnd={(event) =>
                    void saveReaderState({ reading_progress: Number(event.currentTarget.value) })
                  }
                  style={{ width: "100%", marginTop: 8, accentColor: T.azure }}
                />
              </div>

              {readerOpen ? (
                <div style={{ marginTop: 14 }}>
                  {readerText ? (
                    <article
                      style={{
                        maxHeight: 280,
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        fontFamily: FONT,
                        fontSize: 15,
                        lineHeight: 1.7,
                        color: T.ink,
                        background: "rgba(255,255,255,.5)",
                        border: `1px solid ${T.line}`,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      {readerText}
                    </article>
                  ) : (
                    <p style={{ fontFamily: FONT, fontSize: 13, color: T.inkFaint, margin: 0 }}>
                      No readable text is stored yet.
                    </p>
                  )}
                  <p style={{ fontFamily: MONO, fontSize: 10.5, color: T.inkFaint, margin: "7px 0 0 0" }}>
                    Source: {readerSource}
                  </p>

                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    <textarea
                      value={highlightQuote}
                      onChange={(event) => setHighlightQuote(event.target.value)}
                      rows={2}
                      placeholder="Highlight quote"
                      style={{
                        width: "100%",
                        fontFamily: FONT,
                        fontSize: 13,
                        color: T.ink,
                        background: "rgba(255,255,255,.5)",
                        border: `1px solid ${T.line}`,
                        borderRadius: 10,
                        padding: "8px 10px",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
                      <input
                        value={highlightNote}
                        onChange={(event) => setHighlightNote(event.target.value)}
                        placeholder="Note"
                        style={{
                          minWidth: 0,
                          fontFamily: FONT,
                          fontSize: 13,
                          color: T.ink,
                          background: "rgba(255,255,255,.5)",
                          border: `1px solid ${T.line}`,
                          borderRadius: 10,
                          padding: "8px 10px",
                        }}
                      />
                      <select
                        value={highlightColor}
                        onChange={(event) => setHighlightColor(event.target.value as ItemHighlight["color"])}
                        style={{
                          fontFamily: FONT,
                          fontSize: 12,
                          color: T.ink,
                          background: "rgba(255,255,255,.5)",
                          border: `1px solid ${T.line}`,
                          borderRadius: 10,
                          padding: "8px 10px",
                        }}
                      >
                        {["yellow", "green", "blue", "pink", "purple"].map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void createHighlight()}
                        disabled={!highlightQuote.trim() || highlightLoading}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: FONT,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#fff",
                          background: T.azure,
                          border: "none",
                          borderRadius: 10,
                          padding: "8px 11px",
                          cursor: !highlightQuote.trim() || highlightLoading ? "not-allowed" : "pointer",
                          opacity: !highlightQuote.trim() || highlightLoading ? 0.55 : 1,
                        }}
                      >
                        <Highlighter size={13} />
                        Save
                      </button>
                    </div>
                    {highlights.length > 0 ? (
                      <div style={{ display: "grid", gap: 7 }}>
                        {highlights.map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              border: `1px solid ${highlightBorder(entry.color)}`,
                              background: highlightBackground(entry.color),
                              borderRadius: 10,
                              padding: "8px 10px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                              <p style={{ flex: 1, fontFamily: FONT, fontSize: 12.5, lineHeight: 1.5, color: T.ink, margin: 0 }}>
                                {entry.quote}
                              </p>
                              <button
                                type="button"
                                aria-label="Delete highlight"
                                onClick={() => void deleteHighlight(entry.id)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: T.inkFaint,
                                  cursor: "pointer",
                                  padding: 2,
                                }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                            {entry.note ? (
                              <p style={{ fontFamily: FONT, fontSize: 12, color: T.inkSoft, margin: "5px 0 0 0" }}>
                                {entry.note}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* AI Summary block */}
          {item?.summary ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "linear-gradient(120deg,rgba(34,201,168,.1),rgba(61,125,255,.08))",
                border: "1px solid rgba(34,201,168,.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <Sparkles size={14} color={T.mint} />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#0E9E83",
                    textTransform: "uppercase",
                    letterSpacing: ".5px",
                  }}
                >
                  AI summary
                </span>
              </div>
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 13.5,
                  color: T.ink,
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {item.summary}
              </p>
            </div>
          ) : item?.enriched === false ? (
            /* Shimmer placeholder while AI enrichment is pending */
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "linear-gradient(120deg,rgba(34,201,168,.06),rgba(61,125,255,.04))",
                border: "1px solid rgba(34,201,168,.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <Sparkles size={14} color={T.inkFaint} />
                <span
                  style={{
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 700,
                    color: T.inkFaint,
                    textTransform: "uppercase",
                    letterSpacing: ".5px",
                  }}
                >
                  AI summary
                </span>
              </div>
              {/* Shimmer bars */}
              {[80, 95, 60].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 10,
                    borderRadius: 6,
                    marginBottom: i < 2 ? 8 : 0,
                    width: `${w}%`,
                    background: "linear-gradient(90deg,rgba(154,164,184,0) 0%,rgba(154,164,184,.32) 50%,rgba(154,164,184,0) 100%)",
                    backgroundSize: "400px 100%",
                    animation: "shimmer 1.4s ease-in-out infinite",
                  }}
                />
              ))}
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  color: T.inkFaint,
                  marginTop: 10,
                  marginBottom: 0,
                }}
              >
                AI is enriching this item…
              </p>
            </div>
          ) : null}

          {/* Editable summary textarea */}
          <div style={{ marginTop: 18 }}>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 700,
                color: T.inkFaint,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 6,
              }}
            >
              Summary
            </div>
            <textarea
              value={draftSummary}
              onChange={(e) => setDraftSummary(e.target.value)}
              rows={3}
              placeholder="Add a concise summary for this item."
              aria-label="Item summary"
              style={{
                width: "100%",
                fontFamily: FONT,
                fontSize: 13.5,
                color: T.ink,
                lineHeight: 1.55,
                background: "rgba(255,255,255,.5)",
                border: `1px solid ${T.line}`,
                borderRadius: 12,
                padding: "10px 12px",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Tags */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 700,
                color: T.inkFaint,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 6,
              }}
            >
              Tags
            </div>
            <input
              value={draftTagsInput}
              onChange={(e) => setDraftTagsInput(e.target.value)}
              placeholder="ai, reading, startup"
              aria-label="Tags, comma-separated"
              style={{
                width: "100%",
                fontFamily: MONO,
                fontSize: 13,
                color: T.ink,
                background: "rgba(255,255,255,.5)",
                border: `1px solid ${T.line}`,
                borderRadius: 12,
                padding: "9px 12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {parsedTags.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontFamily: MONO,
                      fontSize: 11,
                      color: T.inkSoft,
                      background: "rgba(255,255,255,.65)",
                      border: `1px solid ${T.glassEdge}`,
                      borderRadius: 20,
                      padding: "3px 10px",
                    }}
                  >
                    <Tag size={9} />
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Folder + Reminder chips row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 16,
            }}
          >
            {/* Folder */}
            <div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.inkFaint,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 6,
                }}
              >
                Folder
              </div>
              <select
                value={draftCollectionId}
                onChange={(e) => setDraftCollectionId(e.target.value)}
                aria-label="Assign to folder"
                style={{
                  width: "100%",
                  fontFamily: FONT,
                  fontSize: 13,
                  color: T.ink,
                  background: "rgba(255,255,255,.5)",
                  border: `1px solid ${T.line}`,
                  borderRadius: 12,
                  padding: "9px 12px",
                  outline: "none",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <option value="">No folder</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  color: T.inkFaint,
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                Manage folders in Settings → Folders.
              </p>
            </div>

            {/* Reminder */}
            <div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.inkFaint,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Calendar size={11} color={T.azure} />
                Reminder
              </div>
              <input
                type="datetime-local"
                value={draftReminderAt}
                onChange={(e) => setDraftReminderAt(e.target.value)}
                style={{
                  width: "100%",
                  fontFamily: FONT,
                  fontSize: 13,
                  color: T.ink,
                  background: "rgba(255,255,255,.5)",
                  border: `1px solid ${T.line}`,
                  borderRadius: 12,
                  padding: "9px 12px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Reminder preset chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
            {REMINDER_PRESETS.map(({ label, days, hour }) => (
              <button
                key={label}
                type="button"
                onClick={() => applyReminderPreset(days, hour)}
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  color: T.inkSoft,
                  background: "rgba(255,255,255,.6)",
                  border: `1px solid ${T.glassEdge}`,
                  borderRadius: 20,
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
            {draftReminderAt ? (
              <button
                type="button"
                onClick={() => setDraftReminderAt("")}
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  color: "#dc2626",
                  background: "rgba(239,68,68,.08)",
                  border: "1px solid rgba(239,68,68,.2)",
                  borderRadius: 20,
                  padding: "4px 12px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            ) : null}
          </div>

          {draftReminderAt ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: FONT,
                fontSize: 12,
                color: T.azure,
                background: "rgba(61,125,255,.08)",
                border: "1px solid rgba(61,125,255,.2)",
                borderRadius: 20,
                padding: "4px 12px",
                marginTop: 8,
              }}
            >
              <Calendar size={11} />
              Reminds at {new Date(draftReminderAt).toLocaleString()}
            </div>
          ) : null}

          {/* Save / Delete row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginTop: 22,
              paddingTop: 18,
              borderTop: `1px solid ${T.line}`,
            }}
          >
            <button
              type="button"
              onClick={() => setDeletePending(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: FONT,
                fontSize: 12.5,
                color: "#dc2626",
                background: "rgba(239,68,68,.06)",
                border: "1px solid rgba(239,68,68,.18)",
                borderRadius: 12,
                padding: "7px 14px",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} />
              Delete item
            </button>
            <button
              type="button"
              onClick={saveMetadata}
              disabled={savingMeta || !dirtyMeta}
              style={{
                fontFamily: FONT,
                fontSize: 13.5,
                fontWeight: 600,
                color: "#fff",
                background:
                  savingMeta || !dirtyMeta
                    ? "rgba(61,125,255,.4)"
                    : `linear-gradient(135deg, ${T.azure}, ${T.azureDeep})`,
                border: "none",
                borderRadius: 12,
                padding: "8px 20px",
                cursor: savingMeta || !dirtyMeta ? "not-allowed" : "pointer",
                opacity: savingMeta || !dirtyMeta ? 0.7 : 1,
              }}
            >
              {savingMeta ? "Saving…" : dirtyMeta ? "Save changes" : "Saved"}
            </button>
          </div>

          {/* Comments section */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 14,
              borderTop: `1px solid ${T.line}`,
            }}
          >
            {/* Section header */}
            <div
              style={{
                fontFamily: FONT,
                fontSize: 12.5,
                fontWeight: 700,
                color: T.inkSoft,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <MessageSquare size={13} color={T.inkSoft} />
              Comments &middot; {comments.length}
            </div>

            {/* Applied actions banner */}
            {applied.length > 0 ? (
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  color: T.azure,
                  background: "rgba(61,125,255,.07)",
                  border: "1px solid rgba(61,125,255,.2)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  marginBottom: 10,
                }}
              >
                Applied: {applied.join(" · ")}
              </div>
            ) : null}

            {/* Comment list */}
            {comments.length === 0 ? (
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  color: T.inkFaint,
                  marginBottom: 16,
                }}
              >
                No comments yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {comments.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: "rgba(255,255,255,.6)",
                      border: `1px solid ${T.glassEdge}`,
                      borderRadius: 11,
                      padding: "9px 12px",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: FONT,
                        fontSize: 13.5,
                        color: T.ink,
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {entry.body}
                    </p>
                    <p
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        color: T.inkFaint,
                        margin: "6px 0 0 0",
                      }}
                      suppressHydrationWarning
                    >
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Comment input */}
            <div
              style={{
                background: "rgba(255,255,255,.55)",
                border: `1px solid ${T.glassEdge}`,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  color: T.inkFaint,
                  margin: "0 0 8px 0",
                }}
              >
                Try <code style={{ fontFamily: MONO }}>remind me on 30 Jan</code>,{" "}
                <code style={{ fontFamily: MONO }}>folder: work</code>, or{" "}
                <code style={{ fontFamily: MONO }}>#ai</code>.
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Add a comment or action…"
                style={{
                  width: "100%",
                  fontFamily: FONT,
                  fontSize: 13.5,
                  color: T.ink,
                  background: "rgba(255,255,255,.5)",
                  border: `1px solid ${T.line}`,
                  borderRadius: 10,
                  padding: "9px 12px",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              {preview ? (
                <div style={{ marginTop: 10 }}>
                  <ActionPreview preview={preview} overrides={overrides} onChange={setOverrides} />
                </div>
              ) : null}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={handleCommentSubmit}
                  disabled={loading || !comment.trim()}
                  style={{
                    fontFamily: FONT,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#fff",
                    background:
                      loading || !comment.trim()
                        ? "rgba(61,125,255,.4)"
                        : `linear-gradient(135deg, ${T.azure}, ${T.mint})`,
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 18px",
                    cursor: loading || !comment.trim() ? "not-allowed" : "pointer",
                    opacity: loading || !comment.trim() ? 0.6 : 1,
                  }}
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

function archiveStatusLabel(status: ArchiveItem["archive_status"]) {
  if (status === "available") return "Archive snapshot saved";
  if (status === "pending") return "Archive queued";
  if (status === "processing") return "Archive running";
  if (status === "failed") return "Archive failed";
  return "No archive snapshot";
}

function archiveStatusDetail(item: ArchiveItem) {
  if (item.link_broken) {
    return item.link_http_status
      ? `Link check failed with HTTP ${item.link_http_status}`
      : item.link_failure_reason || "Link check failed";
  }
  if (item.archive_status === "available") {
    return item.archive_last_attempt_at
      ? `Captured ${new Date(item.archive_last_attempt_at).toLocaleString()}`
      : "Sanitized HTML and text are stored.";
  }
  if (item.archive_status === "failed") {
    return item.archive_last_error || "The page could not be archived.";
  }
  if (item.archive_status === "pending" || item.archive_status === "processing") {
    return "The worker will save sanitized HTML and readable text.";
  }
  if (item.link_last_checked_at) {
    return `Last checked ${new Date(item.link_last_checked_at).toLocaleString()}`;
  }
  return "Save a durable HTML snapshot for this URL.";
}

function readerToggleStyle(active: boolean, color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 700,
    color: active ? color : T.inkSoft,
    background: active ? `${color}14` : "rgba(255,255,255,.55)",
    border: active ? `1px solid ${color}40` : `1px solid ${T.glassEdge}`,
    borderRadius: 10,
    padding: "7px 10px",
    cursor: "pointer",
  };
}

function highlightBorder(color: ItemHighlight["color"]) {
  const colors: Record<ItemHighlight["color"], string> = {
    yellow: "rgba(250,204,21,.45)",
    green: "rgba(34,197,94,.35)",
    blue: "rgba(59,130,246,.35)",
    pink: "rgba(236,72,153,.35)",
    purple: "rgba(168,85,247,.35)",
  };
  return colors[color];
}

function highlightBackground(color: ItemHighlight["color"]) {
  const colors: Record<ItemHighlight["color"], string> = {
    yellow: "rgba(250,204,21,.12)",
    green: "rgba(34,197,94,.09)",
    blue: "rgba(59,130,246,.09)",
    pink: "rgba(236,72,153,.09)",
    purple: "rgba(168,85,247,.09)",
  };
  return colors[color];
}
