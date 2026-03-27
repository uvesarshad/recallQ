"use client";

import { useState } from "react";
import { Calendar, Plus, Tags } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CaptureBar() {
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    if (!value.trim() || loading) return;

    setLoading(true);
    try {
      // Basic type detection
      const type = value.trim().match(/^https?:\/\//) ? "url" : "text";
      const payload = {
        type,
        title: title.trim() || null,
        raw_url: type === "url" ? value.trim() : null,
        raw_text: type === "text" ? value.trim() : null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
        source: "manual",
      };

      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setValue("");
        setTitle("");
        setTags("");
        setReminderAt("");
        router.refresh(); // Refresh the feed
      } else {
        const error = await res.json();
        if (error.error === "limit_reached") {
          router.push(error.upgrade_url);
        }
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-modals border border-border bg-surface p-4">
      <div className="group relative flex items-center gap-2 rounded-input border border-border bg-bg px-4 py-3 transition-all focus-within:border-brand focus-within:ring-1 focus-within:ring-brand-glow">
        <Plus className="h-4 w-4 text-text-muted group-focus-within:text-brand" />
        <input
          type="text"
          placeholder="Paste a link or write a note..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !expanded && handleSave()}
          disabled={loading}
        />
        <button
          onClick={() => setExpanded((current) => !current)}
          className="text-xs font-semibold text-text-muted hover:text-text-primary"
        >
          {expanded ? "Less" : "Details"}
        </button>
        {!loading && value && (
          <button onClick={handleSave} className="text-xs font-semibold text-brand hover:text-brand-hover">
            Save
          </button>
        )}
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded-input border border-border bg-bg px-4 py-3 text-sm text-text-primary outline-none focus:border-brand"
          />
          <div className="relative">
            <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags"
              className="w-full rounded-input border border-border bg-bg py-3 pl-10 pr-4 text-sm text-text-primary outline-none focus:border-brand"
            />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              className="w-full rounded-input border border-border bg-bg py-3 pl-10 pr-4 text-sm text-text-primary outline-none focus:border-brand"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
