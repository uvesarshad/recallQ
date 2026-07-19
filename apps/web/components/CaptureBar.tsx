"use client";

import { useState, useEffect } from "react";
import { Sparkles, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { dispatchArchiveItemCreated } from "@/lib/archive-events";
import { T, FONT, SPRING_UI } from "@recall/tokens";

export default function CaptureBar() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const router = useRouter();
  const reduce = useReducedMotion();

  const active = focused || value.length > 0;

  useEffect(() => {
    if (status === "idle") {
      return;
    }
    const timeout = window.setTimeout(() => setStatus("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function handleSave() {
    if (!value.trim() || loading) return;

    setLoading(true);
    try {
      const trimmed = value.trim();
      const type = trimmed.match(/^https?:\/\//) ? "url" : "text";
      const payload = {
        type,
        raw_url: type === "url" ? trimmed : null,
        raw_text: type === "text" ? trimmed : null,
        source: "manual",
      };

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = (await res.json()) as { id?: string };
        setValue("");
        setStatus("saved");
        if (data.id) {
          dispatchArchiveItemCreated(data.id);
        }
        return;
      }

      const error = await res.json();
      if (error.error === "limit_reached") {
        router.push(error.upgrade_url);
        return;
      }

      setStatus("error");
    } catch (err) {
      console.error("Save failed:", err);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  const placeholder =
    status === "saved"
      ? "Saved! Enrichment queued."
      : status === "error"
        ? "Save failed — try again."
        : "Paste a link or jot a thought…";

  return (
    <motion.div
      animate={reduce ? undefined : { scale: active ? 1.012 : 1 }}
      transition={SPRING_UI}
      style={{ width: "100%", maxWidth: 640 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 50,
          borderRadius: 16,
          background: T.glass,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: active
            ? "1px solid rgba(61,125,255,.5)"
            : `1px solid ${T.glassEdge}`,
          boxShadow: active
            ? `0 0 0 4px rgba(61,125,255,.12), ${T.shadowSoft}`
            : T.shadowSoft,
          padding: "0 8px 0 14px",
          transition:
            "border var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)",
        }}
      >
        <Sparkles
          size={18}
          style={{
            flexShrink: 0,
            color: active ? T.azure : T.inkFaint,
            transition: "color var(--duration-base) var(--ease-out)",
          }}
        />

        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
          }}
          disabled={loading}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontFamily: FONT,
            fontSize: 15,
            color: T.ink,
            minWidth: 0,
          }}
        />

        <motion.button
          type="button"
          whileTap={reduce ? undefined : { scale: 0.96 }}
          onClick={() => void handleSave()}
          disabled={loading || !value.trim()}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 38,
            padding: "0 16px",
            borderRadius: 12,
            border: "none",
            background: active
              ? "linear-gradient(120deg,#3D7DFF,#22C9A8)"
              : "linear-gradient(120deg,#3D7DFF,#3D7DFF)",
            color: "white",
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 6px 16px rgba(61,125,255,.32)",
            cursor: loading || !value.trim() ? "not-allowed" : "pointer",
            opacity: loading || !value.trim() ? 0.5 : 1,
            transition: "background var(--duration-base) var(--ease-out), opacity var(--duration-base) var(--ease-out)",
          }}
        >
          <Plus size={16} />
          Capture
        </motion.button>
      </div>
    </motion.div>
  );
}
