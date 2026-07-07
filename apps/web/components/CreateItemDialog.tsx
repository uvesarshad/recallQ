"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, FileUp, ListPlus, Sparkles, X } from "lucide-react";
import ActionPreview, { type ActionOverrideValue, type ActionPreviewValue } from "@/components/ActionPreview";
import { dispatchArchiveItemCreated, dispatchArchiveItemsChanged } from "@/lib/archive-events";
import { useModalA11y } from "@/lib/use-modal-a11y";

export function openCreateDialog() {
  window.dispatchEvent(new CustomEvent("recall:create"));
}

type CaptureMode = "single" | "bulk" | "file";

const ACCEPTED_FILE_TYPES = ".pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type BulkImportItem = {
  type: "url" | "text";
  raw_url: string | null;
  raw_text: string;
  capture_note: string;
  source: "manual";
};

function buildSinglePayload(value: string, overrides: ActionOverrideValue, archivePage: boolean) {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);

  return {
    type: urlMatch ? "url" : "text",
    raw_url: urlMatch?.[0] || null,
    raw_text: trimmed,
    capture_note: trimmed,
    actionOverrides: overrides,
    source: "manual" as const,
    archive_page: Boolean(urlMatch && archivePage),
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
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [archivePage, setArchivePage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("recall:create", handler);
    return () => window.removeEventListener("recall:create", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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

  function handleFileSelect(file: File) {
    setFileError(null);
    setSelectedFile(file);
  }

  async function handleSubmit() {
    if (loading) return;

    if (mode === "file") {
      if (!selectedFile) return;
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("file", selectedFile);
        const response = await fetch("/api/ingest/file", { method: "POST", body: fd });
        const data = await response.json();
        if (!response.ok) {
          setFileError(data.error === "storage_limit_reached"
            ? "Storage limit reached. Upgrade your plan to upload more files."
            : data.error === "unsupported_file_type"
              ? "That file type is not supported."
              : data.error === "file_too_large"
                ? "File exceeds the size limit for your plan."
                : "Upload failed. Please try again.");
          return;
        }
        setOpen(false);
        setSelectedFile(null);
        if (data.id) dispatchArchiveItemCreated(data.id);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!content.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "bulk"
            ? { items: bulkItems }
            : buildSinglePayload(content, overrides, archivePage),
        ),
      });
      if (!response.ok) throw new Error("Failed to create item");
      const data = (await response.json()) as { id?: string; count?: number; items?: Array<{ id?: string }> };
      setOpen(false);
      setMode("single");
      setContent("");
      setPreview(null);
      setOverrides({});
      setArchivePage(false);
      if (mode === "bulk") {
        dispatchArchiveItemsChanged();
      } else if (data.id) {
        dispatchArchiveItemCreated(data.id);
      } else if (data.items?.[0]?.id) {
        dispatchArchiveItemCreated(data.items[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  const containerRef = useModalA11y(open);
  const singleUrlMatch = mode === "single" ? content.trim().match(/https?:\/\/[^\s]+/) : null;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-modals border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 id="create-dialog-title" className="text-lg font-semibold text-text-primary">Create Item</h2>
            <p className="text-sm text-text-muted">
              {mode === "bulk" ? "Paste one link or note per line to import several items at once." : "One box. Paste anything and describe what should happen."}
            </p>
          </div>
          <button aria-label="Close dialog" className="rounded-buttons p-2 text-text-muted hover:bg-surface-2" onClick={() => { setOpen(false); setSelectedFile(null); setFileError(null); }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <div role="group" aria-label="Capture mode" className="inline-flex w-fit rounded-buttons border border-border bg-bg p-1 text-sm">
            <button
              aria-pressed={mode === "single"}
              className={`rounded-buttons px-3 py-1.5 transition ${mode === "single" ? "bg-brand text-white" : "text-text-muted hover:text-text-primary"}`}
              onClick={() => setMode("single")}
              type="button"
            >
              Single
            </button>
              <button
                aria-pressed={mode === "bulk"}
              className={`inline-flex items-center gap-2 rounded-buttons px-3 py-1.5 transition ${mode === "bulk" ? "bg-brand text-white" : "text-text-muted hover:text-text-primary"}`}
              onClick={() => { setMode("bulk"); setPreview(null); setOverrides({}); setArchivePage(false); }}
              type="button"
            >
              <ListPlus className="h-4 w-4" />
              Bulk import
            </button>
            <button
              aria-pressed={mode === "file"}
              className={`inline-flex items-center gap-2 rounded-buttons px-3 py-1.5 transition ${mode === "file" ? "bg-brand text-white" : "text-text-muted hover:text-text-primary"}`}
              onClick={() => { setMode("file"); setPreview(null); setOverrides({}); setArchivePage(false); setFileError(null); }}
              type="button"
            >
              <FileUp className="h-4 w-4" />
              File
            </button>
          </div>
          {mode === "file" ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="sr-only"
                aria-label="Select file"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
              <div
                role="button"
                tabIndex={0}
                aria-label="Drop a file here or click to browse"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileSelect(f);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-input border-2 border-dashed px-4 py-10 text-center transition-colors ${
                  dragOver ? "border-brand bg-brand/5" : "border-border hover:border-brand/50"
                }`}
              >
                <FileUp className={`h-8 w-8 ${dragOver ? "text-brand" : "text-text-muted"}`} />
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-text-primary">{selectedFile.name}</p>
                    <p className="text-xs text-text-muted">{formatFileSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-text-primary">Drop a file or click to browse</p>
                    <p className="text-xs text-text-muted">PDF, images, DOCX, XLSX, plain text, Markdown</p>
                  </div>
                )}
              </div>
              {fileError && <p className="text-sm text-red-400">{fileError}</p>}
            </>
          ) : (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                mode === "bulk"
                  ? "https://example.com/article\nReview pricing page next week\nhttps://another-site.com/report"
                  : "Paste a link or write a note. Example: https://example.com remind me this on 30 Jan folder: work #design"
              }
              aria-label={mode === "bulk" ? "Items to import, one per line" : "Capture content"}
              rows={9}
              className="rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none focus:border-brand"
            />
          )}
          {mode === "single" ? (
            <>
              <div className="rounded-cards border border-brand/20 bg-brand/5 p-4 text-sm text-text-mid">
                <div className="mb-2 inline-flex items-center gap-2 text-brand">
                  <Sparkles className="h-4 w-4" />
                  Natural language capture
                </div>
                <p>Use phrases like `remind me this on 30 Jan`, `folder: work`, `tags: design, research`, or hashtags like `#product`.</p>
              </div>
              {singleUrlMatch ? (
                <label className="flex items-center justify-between gap-4 rounded-cards border border-border bg-bg p-4 text-sm">
                  <span className="inline-flex min-w-0 items-center gap-3 text-text-primary">
                    <Archive className="h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0">
                      <span className="block font-medium">Archive page HTML</span>
                      <span className="block text-xs text-text-muted">Save a durable sanitized snapshot in the background.</span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={archivePage}
                    onChange={(event) => setArchivePage(event.target.checked)}
                    className="h-4 w-4 accent-brand"
                  />
                </label>
              ) : null}
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
              disabled={loading || (mode === "file" ? !selectedFile : !content.trim())}
              className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={handleSubmit}
            >
              {loading
                ? mode === "file" ? "Uploading..." : mode === "bulk" ? "Importing..." : "Saving..."
                : mode === "file" ? "Upload file"
                : mode === "bulk" ? `Import ${bulkItems.length || ""}`.trim()
                : "Save item"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
