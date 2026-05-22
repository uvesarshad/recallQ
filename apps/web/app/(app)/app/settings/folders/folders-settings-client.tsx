"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FolderCog, Plus, Trash2 } from "lucide-react";
import type { CollectionRecord } from "@/lib/types";

// Folder management — moved out of the Feed sidebar so the dashboard can
// stay clean. Each row is edit-in-place: type a name, pick a color, set an
// icon string, save. Deleting a folder unlinks its items (the API handles
// that by setting `collection_id = NULL` on each item).

const FOLDER_COLORS = [
  "#6366f1",
  "#38bdf8",
  "#22c55e",
  "#f97316",
  "#e879f9",
  "#facc15",
  "#14b8a6",
];

type Folder = CollectionRecord & { count?: number };

type EditDraft = {
  name: string;
  icon: string;
  color: string;
};

function makeDraft(folder: Folder): EditDraft {
  return {
    name: folder.name,
    icon: folder.icon ?? "folder",
    color: folder.color ?? FOLDER_COLORS[0],
  };
}

export default function FoldersSettingsClient() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);
  const [creating, setCreating] = useState(false);

  async function loadFolders() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/collections");
      if (!response.ok) throw new Error("Failed to load folders");
      const data = (await response.json()) as { collections?: Folder[] };
      const list = data.collections ?? [];
      setFolders(list);
      setDrafts(Object.fromEntries(list.map((f) => [f.id, makeDraft(f)])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load folders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFolders();
  }, []);

  function patchDraft(folderId: string, patch: Partial<EditDraft>) {
    setDrafts((current) => ({
      ...current,
      [folderId]: { ...current[folderId], ...patch },
    }));
  }

  const hasChanges = useMemo(() => {
    const set = new Set<string>();
    for (const folder of folders) {
      const draft = drafts[folder.id];
      if (!draft) continue;
      const changed =
        draft.name.trim() !== folder.name ||
        draft.icon !== (folder.icon ?? "folder") ||
        draft.color !== (folder.color ?? FOLDER_COLORS[0]);
      if (changed) set.add(folder.id);
    }
    return set;
  }, [drafts, folders]);

  async function saveFolder(folderId: string) {
    const draft = drafts[folderId];
    if (!draft || savingId) return;
    setSavingId(folderId);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim() || undefined,
          icon: draft.icon.trim() || undefined,
          color: draft.color,
        }),
      });
      if (!response.ok) {
        setError("Couldn't save folder changes.");
        return;
      }
      const data = (await response.json()) as { collection?: Folder };
      if (data.collection) {
        setFolders((current) =>
          current.map((f) => (f.id === data.collection!.id ? data.collection! : f)),
        );
        setDrafts((current) => ({ ...current, [data.collection!.id]: makeDraft(data.collection!) }));
      }
    } finally {
      setSavingId(null);
    }
  }

  async function deleteFolder(folderId: string) {
    if (deletingId) return;
    setDeletingId(folderId);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${folderId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError("Couldn't delete folder.");
        return;
      }
      setFolders((current) => current.filter((f) => f.id !== folderId));
      setDrafts((current) => {
        const next = { ...current };
        delete next[folderId];
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function createFolder() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon: "folder", color: newColor }),
      });
      if (!response.ok) {
        setError("Couldn't create folder.");
        return;
      }
      const data = (await response.json()) as { collection?: Folder };
      if (data.collection) {
        setFolders((current) => [data.collection!, ...current]);
        setDrafts((current) => ({ ...current, [data.collection!.id]: makeDraft(data.collection!) }));
      }
      setNewName("");
      setNewColor(FOLDER_COLORS[0]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-modals border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-buttons bg-brand/10 text-brand">
            <FolderCog className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Folders</h1>
            <p className="text-sm text-text-muted">
              Group items into folders, then filter by folder on the dashboard.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-buttons border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
      </section>

      <section className="rounded-modals border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          New folder
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createFolder();
            }}
            placeholder="Folder name"
            className="flex-1 min-w-[220px] rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
          />
          <ColorSwatches value={newColor} onChange={setNewColor} />
          <button
            type="button"
            onClick={() => void createFolder()}
            disabled={!newName.trim() || creating}
            className="inline-flex items-center gap-2 rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </section>

      <section className="rounded-modals border border-border bg-surface">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            Your folders {folders.length > 0 ? `(${folders.length})` : ""}
          </h2>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-sm text-text-muted">Loading folders…</p>
        ) : folders.length === 0 ? (
          <p className="px-6 py-8 text-sm text-text-muted">
            No folders yet. Create one above, or from the dashboard&apos;s &ldquo;+ Folder&rdquo; button.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {folders.map((folder) => {
              const draft = drafts[folder.id] ?? makeDraft(folder);
              const dirty = hasChanges.has(folder.id);
              return (
                <li key={folder.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-buttons text-base"
                      style={{ backgroundColor: `${draft.color}25`, color: draft.color }}
                      aria-hidden="true"
                    >
                      {draft.icon || "📁"}
                    </span>
                    <input
                      value={draft.name}
                      onChange={(e) => patchDraft(folder.id, { name: e.target.value })}
                      placeholder="Folder name"
                      className="min-w-[200px] flex-1 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
                    />
                    <input
                      value={draft.icon}
                      onChange={(e) => patchDraft(folder.id, { icon: e.target.value })}
                      placeholder="Icon (emoji or text)"
                      className="w-[160px] rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
                    />
                    <ColorSwatches
                      value={draft.color}
                      onChange={(color) => patchDraft(folder.id, { color })}
                    />
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveFolder(folder.id)}
                        disabled={!dirty || savingId === folder.id}
                        className="inline-flex items-center gap-1.5 rounded-buttons bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {savingId === folder.id ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteFolder(folder.id)}
                        disabled={deletingId === folder.id}
                        className="inline-flex items-center gap-1.5 rounded-buttons border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                        aria-label={`Delete ${folder.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-text-muted">
        Deleting a folder unlinks every item from it. The items themselves stay in your archive.
      </p>
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Folder color" className="flex items-center gap-1.5">
      {FOLDER_COLORS.map((color) => {
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(color)}
            className={`h-6 w-6 rounded-full transition ${
              active ? "ring-2 ring-offset-2 ring-offset-surface" : "opacity-70 hover:opacity-100"
            }`}
            style={{
              backgroundColor: color,
              boxShadow: active ? `0 0 0 2px ${color}` : undefined,
            }}
            aria-label={`Color ${color}`}
          />
        );
      })}
    </div>
  );
}
