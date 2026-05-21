"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { CollectionRecord } from "@/lib/types";

export interface ActionPreviewValue {
  tags: string[];
  categoryName: string | null;
  reminderAt: string | null;
  confidence: "high" | "medium" | "low";
}

export interface ActionOverrideValue {
  tags?: string[];
  categoryName?: string | null;
  reminderAt?: string | null;
}

const confidenceTone = {
  high: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export default function ActionPreview({
  preview,
  overrides,
  onChange,
}: {
  preview: ActionPreviewValue;
  overrides: ActionOverrideValue;
  onChange: (next: ActionOverrideValue) => void;
}) {
  const activeTags = overrides.tags ?? preview.tags;
  const activeCategoryName =
    Object.prototype.hasOwnProperty.call(overrides, "categoryName")
      ? overrides.categoryName ?? null
      : preview.categoryName;
  const activeReminderAt =
    Object.prototype.hasOwnProperty.call(overrides, "reminderAt")
      ? overrides.reminderAt ?? null
      : preview.reminderAt;
  const [collections, setCollections] = useState<Array<Pick<CollectionRecord, "id" | "name">>>([]);
  const [tagInput, setTagInput] = useState("");
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [showReminderEditor, setShowReminderEditor] = useState(false);
  const [categoryInput, setCategoryInput] = useState(activeCategoryName || "");

  useEffect(() => {
    void fetch("/api/collections")
      .then((res) => res.json())
      .then((data) => setCollections(data.collections || []))
      .catch(() => setCollections([]));
  }, []);

  const reminderInputValue = useMemo(() => {
    if (!activeReminderAt) return "";
    const date = new Date(activeReminderAt);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
  }, [activeReminderAt]);

  if (activeTags.length === 0 && !activeCategoryName && !activeReminderAt) {
    return (
      <div className="rounded-cards border border-border bg-bg p-4 text-sm text-text-mid">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Preview</div>
          <span className={`rounded-full border px-2 py-1 text-[11px] ${confidenceTone[preview.confidence]}`}>
            {preview.confidence} confidence
          </span>
        </div>
        <AddTagControl
          tagInput={tagInput}
          setTagInput={setTagInput}
          activeTags={activeTags}
          overrides={overrides}
          onChange={onChange}
        />
      </div>
    );
  }

  return (
    <div className="rounded-cards border border-border bg-bg p-4 text-sm text-text-mid">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Preview</div>
        <span className={`rounded-full border px-2 py-1 text-[11px] ${confidenceTone[preview.confidence]}`}>
          {preview.confidence} confidence
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {activeTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange({ ...overrides, tags: activeTags.filter((value) => value !== tag) })}
            className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-text-primary"
          >
            #{tag}
            <X className="h-3 w-3" />
          </button>
        ))}
        {activeCategoryName ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-text-primary">
            <button
              type="button"
              onClick={() => {
                setCategoryInput(activeCategoryName);
                setShowCategoryEditor((value) => !value);
              }}
            >
              Folder: {activeCategoryName}
            </button>
            <button type="button" onClick={() => onChange({ ...overrides, categoryName: null })}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        {activeReminderAt ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-text-primary">
            <button type="button" onClick={() => setShowReminderEditor((v) => !v)}>
              Reminder: {new Date(activeReminderAt).toLocaleString("en-IN")}
            </button>
            <button type="button" onClick={() => onChange({ ...overrides, reminderAt: null })}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <AddTagControl
          tagInput={tagInput}
          setTagInput={setTagInput}
          activeTags={activeTags}
          overrides={overrides}
          onChange={onChange}
        />
      </div>
      {showCategoryEditor ? (
        <div className="mt-3 rounded-cards border border-border bg-surface p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Folder</div>
          <div className="flex flex-wrap gap-2">
            {collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => {
                  onChange({ ...overrides, categoryName: collection.name });
                  setCategoryInput(collection.name);
                  setShowCategoryEditor(false);
                }}
                className="rounded-full bg-bg px-2 py-1 text-xs text-text-primary"
              >
                {collection.name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              placeholder="New folder"
              className="flex-1 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => {
                onChange({ ...overrides, categoryName: categoryInput.trim() || null });
                setShowCategoryEditor(false);
              }}
              className="rounded-buttons bg-brand px-3 py-2 text-xs text-white"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
      {showReminderEditor ? (
        <div className="mt-3 rounded-cards border border-border bg-surface p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Reminder</div>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={reminderInputValue}
              onChange={(e) =>
                onChange({
                  ...overrides,
                  reminderAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className="flex-1 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => setShowReminderEditor(false)}
              className="rounded-buttons bg-brand px-3 py-2 text-xs text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AddTagControl({
  tagInput,
  setTagInput,
  activeTags,
  overrides,
  onChange,
}: {
  tagInput: string;
  setTagInput: (value: string) => void;
  activeTags: string[];
  overrides: ActionOverrideValue;
  onChange: (next: ActionOverrideValue) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        placeholder="Add tag"
        className="w-28 rounded-input border border-border bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-brand"
      />
      <button
        type="button"
        onClick={() => {
          const normalized = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
          if (!normalized) return;
          onChange({
            ...overrides,
            tags: Array.from(new Set([...activeTags, normalized])),
          });
          setTagInput("");
        }}
        className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-1 text-xs text-text-primary"
      >
        <Plus className="h-3 w-3" />
        Tag
      </button>
    </div>
  );
}
