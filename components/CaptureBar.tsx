"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { dispatchArchiveItemCreated } from "@/lib/archive-events";

export default function CaptureBar() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const router = useRouter();

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

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
      className="flex items-center gap-3 rounded-input border border-border bg-surface px-4 py-2.5 transition-all focus-within:border-brand"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center text-text-muted">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </div>
      <input
        type="text"
        placeholder={
          status === "saved" ? "Saved. Enrichment queued." :
          status === "error" ? "Save failed — try again." :
          "Paste a link or write a note…"
        }
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
      />
      {value.trim() ? (
        <span className="shrink-0 text-[11px] text-text-muted">{value.trim().match(/^https?:\/\//) ? "Link" : "Note"}</span>
      ) : null}
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="shrink-0 rounded-buttons bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-hover disabled:opacity-40"
      >
        Save
      </button>
    </form>
  );
}
