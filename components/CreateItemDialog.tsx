"use client";

import { useEffect, useState } from "react";
import { ListPlus, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import ActionPreview, { type ActionOverrideValue, type ActionPreviewValue } from "@/components/ActionPreview";

export function openCreateDialog() {
  window.dispatchEvent(new CustomEvent("recall:create"));
}

type CaptureMode = "single" | "bulk";

type BulkImportItem = {
  type: "url" | "text";
  raw_url: string | null;
  raw_text: string;
  capture_note: string;
  source: "manual";
};

function buildSinglePayload(value: string, overrides: ActionOverrideValue) {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);

  return {
    type: urlMatch ? "url" : "text",
    raw_url: urlMatch?.[0] || null,
    raw_text: trimmed,
    capture_note: trimmed,
    actionOverrides: overrides,
    source: "manual" as const,
  };
}

function parseBulkImport(value: string): BulkImportItem[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      return {
        type: urlMatch ? "url" : "text",
        raw_url: urlMatch?.[0] || null,
        raw_text: line,
        capture_note: line,
        source: "manual" as const,
      };
    });
}

export default function CreateItemDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CaptureMode>("single");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<ActionPreviewValue | null>(null);
  const [overrides, setOverrides] = useState<ActionOverrideValue>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("recall:create", handler);
    return () => window.removeEventListener("recall:create", handler);
  }, []);

  useEffect(() => {
    if (!open || mode !== "single" || !content.trim()) {
      setPreview(null);
      setOverrides({});
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/actions/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: content }),
        });
        const data = await response.json();
        setPreview(data.preview || null);
      } catch {
        setPreview(null);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [content, mode, open]);

  const bulkItems = parseBulkImport(content);

  async function handleSubmit() {
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "bulk"
            ? { items: bulkItems }
            : buildSinglePayload(content, overrides),
        ),
      });
      if (!response.ok) {
        throw new Error("Failed to create item");
      }
      setOpen(false);
      setMode("single");
      setContent("");
      setPreview(null);
      setOverrides({});
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-modals border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Create Item</h2>
            <p className="text-sm text-text-muted">
              {mode === "bulk" ? "Paste one link or note per line to import several items at once." : "One box. Paste anything and describe what should happen."}
            </p>
          </div>
          <button className="rounded-buttons p-2 text-text-muted hover:bg-surface-2" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <div className="inline-flex w-fit rounded-buttons border border-border bg-bg p-1 text-sm">
            <button
              className={`rounded-buttons px-3 py-1.5 transition ${mode === "single" ? "bg-brand text-white" : "text-text-muted hover:text-text-primary"}`}
              onClick={() => setMode("single")}
              type="button"
            >
              Single
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded-buttons px-3 py-1.5 transition ${mode === "bulk" ? "bg-brand text-white" : "text-text-muted hover:text-text-primary"}`}
              onClick={() => {
                setMode("bulk");
                setPreview(null);
                setOverrides({});
              }}
              type="button"
            >
              <ListPlus className="h-4 w-4" />
              Bulk import
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              mode === "bulk"
                ? "https://example.com/article\nReview pricing page next week\nhttps://another-site.com/report"
                : "Paste a link or write a note. Example: https://example.com remind me this on 30 Jan folder: work #design"
            }
            rows={9}
            className="rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none focus:border-brand"
          />
          {mode === "single" ? (
            <>
              <div className="rounded-cards border border-brand/20 bg-brand/5 p-4 text-sm text-text-mid">
                <div className="mb-2 inline-flex items-center gap-2 text-brand">
                  <Sparkles className="h-4 w-4" />
                  Natural language capture
                </div>
                <p>Use phrases like `remind me this on 30 Jan`, `folder: work`, `tags: design, research`, or hashtags like `#product`.</p>
              </div>
              {preview ? <ActionPreview preview={preview} overrides={overrides} onChange={setOverrides} /> : null}
            </>
          ) : (
            <div className="rounded-cards border border-border bg-bg p-4 text-sm text-text-mid">
              <div className="mb-2 inline-flex items-center gap-2 text-text-primary">
                <ListPlus className="h-4 w-4" />
                Batch preview
              </div>
              <p>
                {bulkItems.length === 0
                  ? "Each non-empty line will become a separate item."
                  : `${bulkItems.length} item${bulkItems.length === 1 ? "" : "s"} ready to import.`}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="rounded-buttons px-4 py-2 text-sm text-text-muted hover:bg-surface-2" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              disabled={loading || !content.trim()}
              className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={handleSubmit}
            >
              {loading ? (mode === "bulk" ? "Importing..." : "Saving...") : mode === "bulk" ? `Import ${bulkItems.length || ""}`.trim() : "Save item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
