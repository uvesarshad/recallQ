"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, FolderCog, Plus, Trash2 } from "lucide-react";
import type { CollectionRecord } from "@/lib/types";
import { T, FONT } from "@recall/tokens";

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

const glassCard: React.CSSProperties = {
  borderRadius: 20,
  overflow: "hidden",
  background: "rgba(255,255,255,.62)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid " + T.glassEdge,
  boxShadow: T.shadowSoft,
  marginBottom: 18,
};

const sectionLabel: React.CSSProperties = {
  padding: "14px 18px",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 700,
  color: T.inkFaint,
  textTransform: "uppercase",
  letterSpacing: ".6px",
  borderBottom: "1px solid " + T.line,
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid " + T.line,
  background: "rgba(255,255,255,0.7)",
  fontFamily: FONT,
  fontSize: 13.5,
  color: T.ink,
  outline: "none",
  minWidth: 0,
};

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
    <div style={{ maxWidth: 620, margin: "0 auto", paddingBottom: 60 }}>
      <h1 style={{ fontFamily: FONT, fontSize: 26, fontWeight: 800, color: T.ink, margin: "8px 0 4px" }}>
        Folders
      </h1>
      <p style={{ fontFamily: FONT, fontSize: 14, color: T.inkSoft, margin: "0 0 22px" }}>
        Group items into folders, then filter by folder on the dashboard.
      </p>

      {/* Header / error banner */}
      {error ? (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", fontFamily: FONT, fontSize: 13, color: "#E11D48" }}>
          {error}
        </div>
      ) : null}

      {/* New folder */}
      <div style={glassCard}>
        <div style={sectionLabel}>New folder</div>
        <div style={{ padding: "18px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(61,125,255,.1)", flexShrink: 0 }}>
            <FolderCog size={18} color={T.azure} />
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createFolder();
            }}
            placeholder="Folder name"
            style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          />
          <ColorSwatches value={newColor} onChange={setNewColor} />
          <button
            type="button"
            onClick={() => void createFolder()}
            disabled={!newName.trim() || creating}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              border: "none",
              background: !newName.trim() || creating
                ? "rgba(11,18,32,0.08)"
                : "linear-gradient(120deg," + T.azure + "," + T.mint + ")",
              color: !newName.trim() || creating ? T.inkFaint : "#fff",
              fontFamily: FONT,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: !newName.trim() || creating ? "not-allowed" : "pointer",
            }}
          >
            <Plus size={15} />
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>

      {/* Folder list */}
      <div style={glassCard}>
        <div style={sectionLabel}>
          Your folders{folders.length > 0 ? ` (${folders.length})` : ""}
        </div>

        {loading ? (
          <div style={{ padding: "24px 18px", fontFamily: FONT, fontSize: 14, color: T.inkFaint }}>
            Loading folders...
          </div>
        ) : folders.length === 0 ? (
          <div style={{ padding: "24px 18px", fontFamily: FONT, fontSize: 14, color: T.inkFaint }}>
            No folders yet. Create one above, or from the dashboard&apos;s &ldquo;+ Folder&rdquo; button.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {folders.map((folder, idx) => {
              const draft = drafts[folder.id] ?? makeDraft(folder);
              const dirty = hasChanges.has(folder.id);
              return (
                <li
                  key={folder.id}
                  style={{
                    padding: "14px 18px",
                    borderBottom: idx < folders.length - 1 ? "1px solid " + T.line : "none",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 10,
                        fontSize: 18,
                        backgroundColor: `${draft.color}25`,
                        color: draft.color,
                      }}
                      aria-hidden="true"
                    >
                      {draft.icon || "📁"}
                    </span>
                    <input
                      value={draft.name}
                      onChange={(e) => patchDraft(folder.id, { name: e.target.value })}
                      placeholder="Folder name"
                      style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                    />
                    <input
                      value={draft.icon}
                      onChange={(e) => patchDraft(folder.id, { icon: e.target.value })}
                      placeholder="Icon"
                      style={{ ...inputStyle, width: 130 }}
                    />
                    <ColorSwatches
                      value={draft.color}
                      onChange={(color) => patchDraft(folder.id, { color })}
                    />
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => void saveFolder(folder.id)}
                        disabled={!dirty || savingId === folder.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: !dirty || savingId === folder.id
                            ? "rgba(11,18,32,0.06)"
                            : "linear-gradient(120deg," + T.azure + "," + T.mint + ")",
                          color: !dirty || savingId === folder.id ? T.inkFaint : "#fff",
                          fontFamily: FONT,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: !dirty || savingId === folder.id ? "not-allowed" : "pointer",
                        }}
                      >
                        <Check size={13} />
                        {savingId === folder.id ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteFolder(folder.id)}
                        disabled={deletingId === folder.id}
                        aria-label={`Delete ${folder.name}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "6px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(244,63,94,0.25)",
                          background: "rgba(244,63,94,0.07)",
                          color: "#E11D48",
                          fontFamily: FONT,
                          fontSize: 12,
                          cursor: deletingId === folder.id ? "not-allowed" : "pointer",
                          opacity: deletingId === folder.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p style={{ fontFamily: FONT, fontSize: 12, color: T.inkFaint }}>
        Deleting a folder unlinks every item from it. The items themselves stay in your archive.
      </p>
    </div>
  );
}

function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Folder color" style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {FOLDER_COLORS.map((color) => {
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(color)}
            aria-label={`Color ${color}`}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              backgroundColor: color,
              opacity: active ? 1 : 0.6,
              outline: active ? `2px solid ${color}` : "none",
              outlineOffset: 2,
              transition: "all 0.15s",
              boxShadow: active ? `0 0 0 2px white, 0 0 0 4px ${color}` : "none",
              padding: 0,
            }}
          />
        );
      })}
    </div>
  );
}
