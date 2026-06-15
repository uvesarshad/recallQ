"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link2, StickyNote, FileText, Image as ImageIcon } from "lucide-react";
import { T, FONT, MONO } from "@recall/tokens";
import ItemDetailModal from "@/components/ItemDetailModal";
import type { ArchiveItem } from "@/lib/types";

function typeIcon(type: ArchiveItem["type"]) {
  switch (type) {
    case "url":
      return <Link2 size={13} />;
    case "note":
      return <StickyNote size={13} />;
    case "file":
      return <FileText size={13} />;
    default:
      return <ImageIcon size={13} />;
  }
}

interface DragRef {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

export default function CanvasClient() {
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const dragRef = useRef<DragRef | null>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    fetch("/api/v1/items?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const layout = useMemo(
    () =>
      items.map((item, i) => ({
        x:
          item.canvas_x != null
            ? item.canvas_x
            : 60 + (i % 3) * 280 + (i % 2 ? 40 : 0),
        y:
          item.canvas_y != null
            ? item.canvas_y
            : 40 + Math.floor(i / 3) * 240 + (i % 3) * 30,
      })),
    [items]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = false;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      };
    },
    [pos]
  );

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      isDragging.current = true;
    }
    setPos({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onMouseLeave = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <>
      {/* Canvas viewport */}
      <div
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={{
          position: "fixed",
          inset: 0,
          top: 81,
          overflow: "hidden",
          cursor: dragRef.current ? "grabbing" : "grab",
          background: T.wash,
          backgroundImage: `radial-gradient(${T.line} 1.2px, transparent 1.2px)`,
          backgroundSize: "26px 26px",
          backgroundPosition: `${pos.x}px ${pos.y}px`,
          fontFamily: FONT,
          userSelect: "none",
        }}
      >
        {/* Inner positioning layer */}
        <div
          style={{
            position: "absolute",
            left: pos.x,
            top: pos.y,
          }}
        >
          {loading && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                color: T.inkFaint,
                fontSize: 14,
                fontFamily: MONO,
                padding: "40px 60px",
              }}
            >
              loading…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div
              style={{
                position: "absolute",
                left: 60,
                top: 40,
                color: T.inkFaint,
                fontSize: 14,
                fontFamily: FONT,
              }}
            >
              No items yet. Save something to see it here.
            </div>
          )}

          {items.map((item, i) => {
            const lx = layout[i]?.x ?? 0;
            const ly = layout[i]?.y ?? 0;
            const hasImage = !!item.image_url;
            return (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isDragging.current) {
                    setSelectedItemId(item.id);
                    setModalOpen(true);
                  }
                }}
                style={{
                  position: "absolute",
                  left: lx,
                  top: ly,
                  width: 230,
                  borderRadius: 16,
                  overflow: "hidden",
                  cursor: "pointer",
                  background: "rgba(255,255,255,.72)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  border: `1px solid ${T.glassEdge}`,
                  boxShadow: T.shadow,
                  transition: "box-shadow 0.15s ease, transform 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    "0 18px 50px rgba(17,34,68,0.16)";
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow =
                    T.shadow;
                  (e.currentTarget as HTMLDivElement).style.transform =
                    "translateY(0)";
                }}
              >
                {/* Optional image strip */}
                {hasImage && (
                  <div
                    style={{
                      height: 90,
                      overflow: "hidden",
                      background: T.line,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image_url!}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                )}

                {/* Card body */}
                <div style={{ padding: 12 }}>
                  {/* Type icon + source */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      color: T.inkFaint,
                      fontSize: 11,
                      fontFamily: MONO,
                      marginBottom: 6,
                    }}
                  >
                    {typeIcon(item.type)}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 170,
                      }}
                    >
                      {item.source
                        ? (() => {
                            try {
                              return new URL(item.source).hostname.replace(
                                /^www\./,
                                ""
                              );
                            } catch {
                              return item.source;
                            }
                          })()
                        : item.type}
                    </span>
                  </div>

                  {/* Title */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: T.ink,
                      fontFamily: FONT,
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {item.title || item.raw_url || "Untitled"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hint badge */}
        {!loading && (
          <div
            style={{
              position: "absolute",
              bottom: 18,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,255,255,.65)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: `1px solid ${T.glassEdge}`,
              borderRadius: 20,
              padding: "7px 14px",
              fontSize: 12,
              color: T.inkFaint,
              fontFamily: FONT,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            drag to pan · click a card to open
          </div>
        )}
      </div>

      {/* Item detail modal */}
      <ItemDetailModal
        itemId={selectedItemId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
