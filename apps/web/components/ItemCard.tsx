"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  CheckSquare2,
  FileText,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Square,
  StickyNote,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { resolvePreviewImageUrl } from "@/lib/item-preview";
import type { ArchiveItem } from "@/lib/types";
import { TagBadge } from "@recall/ui";
import { T, FONT, MONO, SPRING_UI } from "@recall/tokens";

const sourceLabel: Record<string, string> = {
  telegram: "Telegram",
  "pwa-share": "Shared",
  email: "Email",
  web: "Web",
  manual: "Web",
  extension: "Extension",
  mobile: "Mobile",
};

const typeLabel: Record<string, string> = {
  url: "Link",
  text: "Text",
  file: "File",
  note: "Note",
};

function TypeIcon({ type }: { type: string }) {
  const props = { size: 13, color: T.inkFaint };
  switch (type) {
    case "url":
      return <Link2 {...props} />;
    case "note":
    case "text":
      return <StickyNote {...props} />;
    case "file":
      return <FileText {...props} />;
    default:
      return <ImageIcon {...props} />;
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      new Date(dateStr).getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  });
}

function GlassActionBtn({
  label,
  title,
  onClick,
  danger,
  children,
}: {
  label: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        border: `1px solid ${T.glassEdge}`,
        background: hovered
          ? danger
            ? "rgba(239,68,68,0.15)"
            : "rgba(255,255,255,0.9)"
          : "rgba(255,255,255,0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        cursor: "pointer",
        transform: !reduce && pressed ? "scale(0.97)" : "scale(1)",
        transition:
          "background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

export default function ItemCard({
  item,
  index,
  highlight,
  focused = false,
  selectionMode = false,
  selected = false,
  isMobile = false,
  onOpen,
  onToggleSelect,
}: {
  item: ArchiveItem;
  index?: number;
  highlight?: string;
  focused?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  isMobile?: boolean;
  onOpen?: (itemId: string) => void;
  onToggleSelect?: (itemId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const router = useRouter();
  const reduce = useReducedMotion();

  const hostLabel = getHostLabel(item.raw_url);
  const previewImageUrl = resolvePreviewImageUrl(item.image_url, item.raw_url);
  const sourceMeta = sourceLabel[item.source as string] || item.source || "Web";
  const meta = item.raw_url ? hostLabel : sourceMeta;
  const typeName = typeLabel[item.type as string] || "Item";

  const title =
    item.title || item.raw_url || item.file_name || item.raw_text?.slice(0, 140) || "Untitled";
  const body = item.summary || item.snippet || (item.raw_url ? null : item.raw_text);

  const isFresh =
    item.created_at && Date.now() - new Date(item.created_at).getTime() < 5000;

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

  const actionIcons = (
    <div
      style={{ display: "flex", alignItems: "center", gap: 4 }}
      onClick={(e) => e.stopPropagation()}
    >
      {deletePending ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeletePending(false);
            }}
            style={{
              fontFamily: FONT,
              fontSize: 11,
              color: T.inkSoft,
              background: "rgba(255,255,255,0.8)",
              border: `1px solid ${T.glassEdge}`,
              borderRadius: 7,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void deleteItem();
            }}
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              color: "#ef4444",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 7,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            Delete
          </button>
        </>
      ) : (
        <>
          <GlassActionBtn
            label="Comment on item"
            title="Comment"
            onClick={(e) => {
              e.stopPropagation();
              setCommentOpen((c) => !c);
              setMobileMenuOpen(false);
            }}
          >
            <MessageSquare size={13} color={T.inkSoft} />
          </GlassActionBtn>
          <GlassActionBtn
            label="Set reminder"
            title="Remind me tomorrow"
            onClick={(e) => {
              e.stopPropagation();
              void setReminder();
              setMobileMenuOpen(false);
            }}
          >
            <Bell size={13} color={T.inkSoft} />
          </GlassActionBtn>
          <GlassActionBtn
            label="Delete item"
            title="Delete"
            danger
            onClick={(e) => {
              e.stopPropagation();
              void deleteItem();
              setMobileMenuOpen(false);
            }}
          >
            <Trash2 size={13} color="#ef4444" />
          </GlassActionBtn>
        </>
      )}
    </div>
  );

  const mobileMenuBtn = (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <GlassActionBtn
        label="Actions"
        title="More actions"
        onClick={(e) => {
          e.stopPropagation();
          setMobileMenuOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={14} color={T.inkSoft} />
      </GlassActionBtn>
      {mobileMenuOpen && (
        <div
          style={{
            position: "absolute",
            top: 34,
            right: 0,
            zIndex: 30,
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: `1px solid ${T.glassEdge}`,
            borderRadius: 12,
            boxShadow: T.shadowLift,
            padding: "6px 4px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 130,
          }}
        >
          {(
            [
              {
                icon: <MessageSquare size={13} color={T.inkSoft} />,
                label: "Comment",
                action: () => {
                  setCommentOpen((c) => !c);
                  setMobileMenuOpen(false);
                },
              },
              {
                icon: <Bell size={13} color={T.inkSoft} />,
                label: "Remind me",
                action: () => {
                  void setReminder();
                  setMobileMenuOpen(false);
                },
              },
              {
                icon: <Trash2 size={13} color="#ef4444" />,
                label: deletePending ? "Confirm delete" : "Delete",
                action: () => {
                  void deleteItem();
                  setMobileMenuOpen(false);
                },
                danger: true,
              },
            ] as Array<{
              icon: React.ReactNode;
              label: string;
              action: () => void;
              danger?: boolean;
            }>
          ).map(({ icon, label, action, danger }) => (
            <button
              key={label}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                action();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: FONT,
                fontSize: 12.5,
                fontWeight: 500,
                color: danger ? "#ef4444" : T.ink,
                width: "100%",
                textAlign: "left",
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <motion.article
      data-feed-index={index}
      whileHover={reduce ? undefined : { y: -3 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={SPRING_UI}
      onMouseEnter={() => {
        setHovered(true);
        setShowActions(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setShowActions(false);
      }}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect?.(item.id);
          return;
        }
        onOpen?.(item.id);
      }}
      style={{
        breakInside: "avoid",
        marginBottom: 14,
        cursor: "pointer",
        borderRadius: 18,
        overflow: "hidden",
        position: "relative",
        background: "rgba(255,255,255,.62)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: `1px solid ${selected ? T.azure : focused ? `${T.azure}80` : T.glassEdge}`,
        boxShadow: hovered ? T.shadowLift : T.shadowSoft,
        outline: selected
          ? `2px solid ${T.azure}4D`
          : focused
          ? `2px solid ${T.azure}33`
          : "none",
        outlineOffset: 2,
        animation: isFresh ? "dropIn .5s ease" : undefined,
      }}
    >
      {/* Selection checkbox */}
      {selectionMode ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item.id);
          }}
          style={{
            position: "absolute",
            right: 10,
            top: 10,
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: "50%",
            border: `1px solid ${selected ? T.azure : T.glassEdge}`,
            background: selected
              ? T.azure
              : "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
          }}
          aria-label={selected ? "Deselect item" : "Select item"}
        >
          {selected ? (
            <CheckSquare2 size={13} color="#fff" />
          ) : (
            <Square size={13} color={T.inkFaint} />
          )}
        </button>
      ) : null}

      {/* Image section */}
      {previewImageUrl ? (
        <div style={{ position: "relative", width: "100%", height: 180, overflow: "hidden" }}>
          <Image
            src={previewImageUrl}
            alt={item.title || "Preview"}
            fill
            sizes="(min-width: 768px) 720px, 100vw"
            style={{ objectFit: "cover", transition: "transform var(--duration-base) var(--ease-out)" }}
            unoptimized
            {...(item.blur_data_url
              ? { placeholder: "blur" as const, blurDataURL: item.blur_data_url }
              : {})}
          />
          <div
            style={{
              position: "absolute",
              inset: "0 0 0 0",
              background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%)",
            }}
          />
          {/* Action icons over image — top right */}
          {!selectionMode ? (
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: isMobile ? 1 : showActions ? 1 : 0,
                transition: "opacity var(--duration-fast) var(--ease-out)",
                pointerEvents: isMobile || showActions ? "auto" : "none",
              }}
            >
              {isMobile ? mobileMenuBtn : actionIcons}
            </div>
          ) : null}
          {/* Type + source label at bottom of image */}
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: ".5px",
                color: "#fff",
                background: "rgba(0,0,0,0.55)",
                padding: "2px 7px",
                borderRadius: 20,
                backdropFilter: "blur(4px)",
              }}
            >
              {typeName}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: "rgba(255,255,255,0.85)",
                background: "rgba(0,0,0,0.45)",
                padding: "2px 7px",
                borderRadius: 20,
                backdropFilter: "blur(4px)",
                maxWidth: 120,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {meta}
            </span>
          </div>
        </div>
      ) : null}

      {/* Card body */}
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
            <TypeIcon type={item.type} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                color: T.inkFaint,
                textOverflow: "ellipsis",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {meta}
            </span>
          </div>

          {/* Action icons when no image — desktop hover / mobile ⋯ */}
          {!previewImageUrl && !selectionMode ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: isMobile ? 1 : showActions ? 1 : 0,
                transition: "opacity var(--duration-fast) var(--ease-out)",
                pointerEvents: isMobile || showActions ? "auto" : "none",
                flexShrink: 0,
              }}
            >
              {isMobile ? mobileMenuBtn : actionIcons}
            </div>
          ) : null}
        </div>

        {/* Highlight badge */}
        {highlight ? (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: ".5px",
              color: T.azure,
            }}
          >
            {highlight}
          </span>
        ) : null}

        {/* Title */}
        <h3
          style={{
            fontFamily: FONT,
            fontSize: 14.5,
            fontWeight: 600,
            color: T.ink,
            lineHeight: 1.35,
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </h3>

        {/* Body / shimmer */}
        {item.enriched === false ? (
          <div
            className="shimmer"
            style={{
              height: 36,
              borderRadius: 6,
              background: "#EEF2F8",
            }}
          />
        ) : body ? (
          <p
            style={{
              fontFamily: FONT,
              fontSize: 12.5,
              color: T.inkSoft,
              lineHeight: 1.5,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {body}
          </p>
        ) : null}

        {/* Tags */}
        {(item.tags?.length ?? 0) > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(item.tags || []).slice(0, 5).map((tag: string) => (
              <TagBadge key={tag}>{tag}</TagBadge>
            ))}
          </div>
        ) : null}

        {/* Collection name */}
        {item.collection_name ? (
          <span
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 500,
              color: T.azure,
              background: "rgba(61,125,255,0.08)",
              padding: "2px 8px",
              borderRadius: 20,
              display: "inline-block",
              width: "fit-content",
            }}
          >
            {item.collection_name}
          </span>
        ) : null}

        {/* Reminder badge */}
        {item.reminder_at ? (
          <span
            suppressHydrationWarning
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontFamily: FONT,
              fontSize: 11,
              color: "#d97706",
              background: "rgba(245,158,11,0.1)",
              borderRadius: 20,
              padding: "2px 8px",
              width: "fit-content",
            }}
          >
            <Bell size={10} color="#d97706" />
            {new Date(item.reminder_at).toLocaleDateString()}
          </span>
        ) : null}

        {/* Applied commands feedback */}
        {applied.length > 0 ? (
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11,
              color: T.azure,
              background: "rgba(61,125,255,0.08)",
              borderRadius: 8,
              padding: "5px 10px",
            }}
          >
            Applied: {applied.join(" · ")}
          </div>
        ) : null}

        {/* Date row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 2,
          }}
        >
          <span
            suppressHydrationWarning
            style={{
              fontFamily: MONO,
              fontSize: 10.5,
              color: T.inkFaint,
            }}
          >
            {relativeTime(item.created_at)}
          </span>
          {item.enriched === false ? (
            <span
              style={{
                fontFamily: FONT,
                fontSize: 11,
                color: T.azure,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: T.azure,
                  display: "inline-block",
                }}
              />
              Enriching…
            </span>
          ) : null}
        </div>
      </div>

      {/* Comment panel */}
      {commentOpen ? (
        <div
          style={{
            borderTop: `1px solid ${T.line}`,
            background: "rgba(247,249,252,0.7)",
            padding: 14,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Add a comment or action…"
            style={{
              width: "100%",
              fontFamily: FONT,
              fontSize: 12.5,
              color: T.ink,
              background: "rgba(255,255,255,0.8)",
              border: `1px solid ${T.glassEdge}`,
              borderRadius: 8,
              padding: "7px 10px",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: 11, color: T.inkFaint }}>
              Try `folder: work`, `#design`, or `remind me on 30 Jan`.
            </span>
            <button
              type="button"
              onClick={addComment}
              disabled={loading || !comment.trim()}
              style={{
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                background: `linear-gradient(120deg, ${T.azure}, ${T.azureDeep})`,
                border: "none",
                borderRadius: 8,
                padding: "5px 14px",
                cursor: loading || !comment.trim() ? "not-allowed" : "pointer",
                opacity: loading || !comment.trim() ? 0.5 : 1,
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </motion.article>
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
