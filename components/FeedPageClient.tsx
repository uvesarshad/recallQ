"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckSquare2,
  ChevronRight,
  FolderCog,
  FolderPlus,
  Grid2X2,
  Hash,
  Layers3,
  Link2,
  Rows2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemCard from "@/components/ItemCard";
import {
  ARCHIVE_ITEM_CREATED_EVENT,
  ARCHIVE_ITEMS_CHANGED_EVENT,
  dispatchArchiveItemsChanged,
} from "@/lib/archive-events";
import { useStoredState } from "@/lib/hooks";
import type { ArchiveItem, CollectionRecord } from "@/lib/types";

type FeedView = "grid" | "list";
type FeedSort = "newest" | "oldest" | "title";
type FeedType = "all" | "url" | "text" | "note" | "file";
type FeedSource = "all" | "telegram" | "pwa-share" | "email" | "web" | "manual";
type FeedPreset = "all" | "recent" | "links" | "reminders";
type ItemType = Exclude<FeedType, "all">;
type FeedItem = ArchiveItem & { type: ItemType };
type Folder = CollectionRecord;

const typeOptions: Array<{ label: string; value: FeedType }> = [
  { label: "All items", value: "all" },
  { label: "Links", value: "url" },
  { label: "Text", value: "text" },
  { label: "Notes", value: "note" },
  { label: "Files", value: "file" },
];

const sourceOptions: Array<{ label: string; value: FeedSource }> = [
  { label: "All sources", value: "all" },
  { label: "Telegram", value: "telegram" },
  { label: "Shared to app", value: "pwa-share" },
  { label: "Email", value: "email" },
  { label: "Web", value: "web" },
  { label: "Manual", value: "manual" },
];

const presetOptions: Array<{ label: string; value: FeedPreset; icon: typeof Sparkles }> = [
  { label: "All", value: "all", icon: Layers3 },
  { label: "Recent", value: "recent", icon: Sparkles },
  { label: "Links", value: "links", icon: Link2 },
  { label: "Reminders", value: "reminders", icon: CalendarClock },
];

const folderColorOptions = ["#6366f1", "#38bdf8", "#22c55e", "#f97316", "#e879f9", "#facc15", "#14b8a6"];

export default function FeedPageClient({
  initialItems,
  folders,
  initialHasMore,
  initialNextCursor,
}: {
  initialItems: FeedItem[];
  folders: Folder[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [folderRecords, setFolderRecords] = useState<Folder[]>(folders);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [view, setView] = useStoredState<FeedView>("recall-feed-view", "list");
  const [sort, setSort] = useState<FeedSort>("newest");
  const [typeFilter, setTypeFilter] = useState<FeedType>("all");
  const [sourceFilter, setSourceFilter] = useState<FeedSource>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [mobileTagsOpen, setMobileTagsOpen] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useStoredState("recall-tags-collapsed", false);
  const [folderInput, setFolderInput] = useState("");
  const [activePreset, setActivePreset] = useState<FeedPreset>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [bulkReminderAt, setBulkReminderAt] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const countdownRef = useRef<number | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string>("");
  const [folderEditName, setFolderEditName] = useState("");
  const [folderEditIcon, setFolderEditIcon] = useState("");
  const [folderEditColor, setFolderEditColor] = useState(folderColorOptions[0]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [savingFolder, setSavingFolder] = useState(false);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const deleteTimeoutRef = useRef<number | null>(null);
  const pendingDeleteRef = useRef<{
    ids: string[];
    previousItems: FeedItem[];
  } | null>(null);

  useEffect(() => {
    setItems(initialItems);
    setFolderRecords(folders);
    setHasMore(initialHasMore);
    setNextCursor(initialNextCursor);
  }, [folders, initialHasMore, initialItems, initialNextCursor]);

  useEffect(() => {
    const source = searchParams.get("source");
    if (source === "telegram" || source === "pwa-share" || source === "email" || source === "web" || source === "manual") {
      setSourceFilter(source);
      return;
    }

    setSourceFilter("all");
  }, [searchParams]);

  useEffect(() => {
    if (!selectedFolderId) {
      setEditingFolderId("");
      setFolderEditName("");
      setFolderEditIcon("");
      setFolderEditColor(folderColorOptions[0]);
      return;
    }

    const folder = folderRecords.find((entry) => entry.id === selectedFolderId);
    if (!folder) {
      return;
    }

    setEditingFolderId(folder.id);
    setFolderEditName(folder.name);
    setFolderEditIcon(folder.icon || "folder");
    setFolderEditColor(folder.color || folderColorOptions[0]);
  }, [folderRecords, selectedFolderId]);

  useEffect(() => {
    function handleCreated(event: Event) {
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      const itemId = detail?.itemId;
      if (!itemId) {
        return;
      }

      void fetch(`/api/items/${itemId}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Failed to load item");
          }
          return (await response.json()) as { item?: FeedItem };
        })
        .then((data) => {
          if (!data.item) {
            return;
          }
          setItems((current) => [data.item!, ...current.filter((item) => item.id !== data.item!.id)]);
        })
        .catch(() => {
          setSurfaceError("A new item was saved, but the feed did not refresh automatically.");
        });
    }

    function handleChanged() {
      void reloadItems();
    }

    window.addEventListener(ARCHIVE_ITEM_CREATED_EVENT, handleCreated as EventListener);
    window.addEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, handleChanged);

    return () => {
      window.removeEventListener(ARCHIVE_ITEM_CREATED_EVENT, handleCreated as EventListener);
      window.removeEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, handleChanged);
    };
  }, []);

  async function reloadItems() {
    setSurfaceError(null);
    const response = await fetch("/api/items?limit=50");
    if (!response.ok) {
      setSurfaceError("The archive could not be refreshed right now.");
      return;
    }

    const data = (await response.json()) as {
      items?: FeedItem[];
      hasMore?: boolean;
      nextCursor?: string | null;
    };

    setItems(data.items || []);
    setHasMore(Boolean(data.hasMore));
    setNextCursor(data.nextCursor ?? null);
  }

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of items) {
      for (const tag of item.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [items]);

  const foldersWithCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of items) {
      if (item.collection_id) {
        counts.set(item.collection_id, (counts.get(item.collection_id) || 0) + 1);
      }
    }

    return folderRecords.map((folder) => ({
      ...folder,
      count: counts.get(folder.id) || 0,
    }));
  }, [folderRecords, items]);

  const filteredItems = useMemo(() => {
    const next = items.filter((item) => {
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => (item.tags || []).includes(tag));
      const matchesFolder = !selectedFolderId || item.collection_id === selectedFolderId;
      const matchesPreset =
        activePreset === "all" ||
        (activePreset === "recent" && Date.now() - new Date(item.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000) ||
        (activePreset === "links" && item.type === "url") ||
        (activePreset === "reminders" && Boolean(item.reminder_at));

      return matchesType && matchesSource && matchesTags && matchesFolder && matchesPreset;
    });

    next.sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sort === "title") {
        const titleA = (a.title || a.raw_url || a.file_name || a.raw_text || "").toLowerCase();
        const titleB = (b.title || b.raw_url || b.file_name || b.raw_text || "").toLowerCase();
        return titleA.localeCompare(titleB);
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return next;
  }, [activePreset, items, selectedTags, selectedFolderId, sort, sourceFilter, typeFilter]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const gridClass = useMemo(
    () => (view === "grid" ? "grid gap-4 md:grid-cols-2" : "space-y-4"),
    [view],
  );

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    );
  }

  function toggleSelection(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((entry) => entry !== itemId) : [...current, itemId],
    );
  }

  function resetSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
    setBulkFolderId("");
    setBulkTagsInput("");
    setBulkReminderAt("");
    setBatchError(null);
  }

  async function createFolder() {
    const name = folderInput.trim();
    if (!name || creatingFolder) {
      return;
    }

    setCreatingFolder(true);
    setSurfaceError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon: "folder", color: folderColorOptions[0] }),
      });

      if (!response.ok) {
        setSurfaceError("The folder could not be created right now.");
        return;
      }

      const data = (await response.json()) as { collection?: Folder };
      if (data.collection) {
        setFolderRecords((current) => [data.collection!, ...current]);
        setSelectedFolderId(data.collection.id);
      }

      setFolderInput("");
      dispatchArchiveItemsChanged();
    } finally {
      setCreatingFolder(false);
    }
  }

  async function saveFolderCustomization() {
    if (!editingFolderId || savingFolder) {
      return;
    }

    setSavingFolder(true);
    setSurfaceError(null);
    try {
      const response = await fetch(`/api/collections/${editingFolderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderEditName.trim() || undefined,
          icon: folderEditIcon.trim() || undefined,
          color: folderEditColor,
        }),
      });

      if (!response.ok) {
        setSurfaceError("The folder style could not be saved.");
        return;
      }

      const data = (await response.json()) as { collection?: Folder };
      if (!data.collection) {
        return;
      }

      setFolderRecords((current) => current.map((folder) => (folder.id === data.collection!.id ? data.collection! : folder)));
      dispatchArchiveItemsChanged();
    } finally {
      setSavingFolder(false);
    }
  }

  const activeFiltersCount =
    (typeFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    selectedTags.length +
    (selectedFolderId ? 1 : 0) +
    (activePreset !== "all" ? 1 : 0);

  async function loadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setSurfaceError(null);
    try {
      const response = await fetch(`/api/items?limit=50&cursor=${encodeURIComponent(nextCursor)}`);
      if (!response.ok) {
        setSurfaceError("More items could not be loaded right now.");
        return;
      }

      const data = (await response.json()) as {
        items?: FeedItem[];
        hasMore?: boolean;
        nextCursor?: string | null;
      };

      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        const nextItems = (data.items || []).filter((item) => !seen.has(item.id));
        return [...current, ...nextItems];
      });
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  }

  async function applyBatchAction(kind: "update" | "delete") {
    if (selectedIds.length === 0 || batchLoading) {
      return;
    }

    if (kind === "delete") {
      if (deleteTimeoutRef.current) {
        window.clearTimeout(deleteTimeoutRef.current);
      }

      pendingDeleteRef.current = {
        ids: selectedIds,
        previousItems: items,
      };
      setItems((current) => current.filter((item) => !selectedIdSet.has(item.id)));
      setPendingDeleteCount(selectedIds.length);
      setBatchError(null);
      resetSelection();

      setDeleteCountdown(5);
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = window.setInterval(() => {
        setDeleteCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) { window.clearInterval(countdownRef.current); countdownRef.current = null; }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      deleteTimeoutRef.current = window.setTimeout(async () => {
        const pendingDelete = pendingDeleteRef.current;
        if (!pendingDelete) {
          return;
        }

        setBatchLoading(true);
        try {
          const response = await fetch("/api/items/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: pendingDelete.ids, action: { kind: "delete" } }),
          });

          if (!response.ok) {
            setItems(pendingDelete.previousItems);
            setBatchError("The selected items could not be deleted.");
            return;
          }

          dispatchArchiveItemsChanged();
        } finally {
          pendingDeleteRef.current = null;
          setPendingDeleteCount(0);
          setBatchLoading(false);
        }
      }, 5000);

      return;
    }

    setBatchLoading(true);
    setBatchError(null);
    try {
      const tags = bulkTagsInput
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);

      const action = {
        kind: "update" as const,
        collection_id: bulkFolderId === "clear" ? null : bulkFolderId || undefined,
        tags: tags.length > 0 ? Array.from(new Set(tags)) : undefined,
        reminder_at: bulkReminderAt ? new Date(bulkReminderAt).toISOString() : bulkReminderAt === "" ? null : undefined,
      };

      const response = await fetch("/api/items/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action }),
      });

      if (!response.ok) {
        setBatchError("The selected items could not be updated.");
        return;
      }

      const selectedFolder = folderRecords.find((folder) => folder.id === bulkFolderId);
      setItems((current) =>
        current.map((item) =>
          selectedIdSet.has(item.id)
            ? {
                ...item,
                collection_id: action.collection_id !== undefined ? action.collection_id : item.collection_id,
                collection_name: action.collection_id !== undefined ? selectedFolder?.name || null : item.collection_name,
                tags: action.tags !== undefined ? action.tags : item.tags,
                reminder_at: action.reminder_at !== undefined ? action.reminder_at : item.reminder_at,
              }
            : item,
        ),
      );

      resetSelection();
      dispatchArchiveItemsChanged();
    } finally {
      setBatchLoading(false);
    }
  }

  function undoPendingDelete() {
    const pendingDelete = pendingDeleteRef.current;
    if (!pendingDelete) {
      return;
    }

    if (deleteTimeoutRef.current) {
      window.clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    setItems(pendingDelete.previousItems);
    pendingDeleteRef.current = null;
    setPendingDeleteCount(0);
    setBatchError(null);
  }

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) window.clearTimeout(deleteTimeoutRef.current);
      if (countdownRef.current) window.clearInterval(countdownRef.current);
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <h1 className="mb-4 text-xl font-semibold text-text-primary">Your archive</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {presetOptions.map(({ label, value, icon: Icon }) => {
          const active = activePreset === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActivePreset(value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-surface text-text-primary hover:border-brand/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>

      <div className={`grid gap-6 transition-all duration-300 ${tagsCollapsed ? "xl:grid-cols-[1fr_0rem]" : "xl:grid-cols-[minmax(0,1fr)_18rem]"}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              <span>Type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as FeedType)}
                className="bg-transparent text-text-primary outline-none"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-surface text-text-primary">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              <span>Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as FeedSort)}
                className="bg-transparent text-text-primary outline-none"
              >
                <option value="newest" className="bg-surface text-text-primary">Newest</option>
                <option value="oldest" className="bg-surface text-text-primary">Oldest</option>
                <option value="title" className="bg-surface text-text-primary">Title A-Z</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              <span>Source</span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as FeedSource)}
                className="bg-transparent text-text-primary outline-none"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-surface text-text-primary">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-sm text-text-muted">
              <span>Folder</span>
              <select
                value={selectedFolderId}
                onChange={(event) => setSelectedFolderId(event.target.value)}
                className="bg-transparent text-text-primary outline-none"
              >
                <option value="" className="bg-surface text-text-primary">All folders</option>
                {foldersWithCounts.map((folder) => (
                  <option key={folder.id} value={folder.id} className="bg-surface text-text-primary">
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => setMobileTagsOpen((current) => !current)}
              className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary xl:hidden"
            >
              <Hash className="h-4 w-4" />
              Tags
              {selectedTags.length > 0 ? (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{selectedTags.length}</span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectionMode) {
                  resetSelection();
                } else {
                  setSelectionMode(true);
                }
              }}
              className={`inline-flex items-center gap-2 rounded-buttons border px-3 py-2 text-sm ${
                selectionMode
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-bg text-text-primary"
              }`}
            >
              <CheckSquare2 className="h-4 w-4" />
              {selectionMode ? "Exit select" : "Select"}
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button
                className={`rounded-buttons px-3 py-2 text-sm ${view === "list" ? "bg-brand text-white" : "text-text-muted"}`}
                onClick={() => setView("list")}
                type="button"
              >
                <Rows2 className="h-4 w-4" />
              </button>
              <button
                className={`rounded-buttons px-3 py-2 text-sm ${view === "grid" ? "bg-brand text-white" : "text-text-muted"}`}
                onClick={() => setView("grid")}
                type="button"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectionMode ? (
            <div className="mt-3 rounded-modals border border-border bg-surface p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {selectedIds.length > 0 ? (
                    <p className="text-sm text-text-primary">{selectedIds.length} item{selectedIds.length === 1 ? "" : "s"} selected</p>
                  ) : null}
                </div>
                {selectedIds.length > 0 ? (
                  <button type="button" onClick={() => setSelectedIds(filteredItems.map((item) => item.id))} className="text-xs text-brand hover:text-brand-hover">
                    Select filtered
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
                <select
                  value={bulkFolderId}
                  onChange={(event) => setBulkFolderId(event.target.value)}
                  className="rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                >
                  <option value="">Keep current folder</option>
                  <option value="clear">Clear folder</option>
                  {folderRecords.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
                <input
                  value={bulkTagsInput}
                  onChange={(event) => setBulkTagsInput(event.target.value)}
                  placeholder="Replace tags: ai, reading"
                  className="rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                />
                <input
                  type="datetime-local"
                  value={bulkReminderAt}
                  onChange={(event) => setBulkReminderAt(event.target.value)}
                  className="rounded-input border border-border bg-bg px-3 py-3 text-sm text-text-primary outline-none focus:border-brand"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={selectedIds.length === 0 || batchLoading}
                    onClick={() => void applyBatchAction("update")}
                    className="rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    disabled={selectedIds.length === 0 || batchLoading}
                    onClick={() => void applyBatchAction("delete")}
                    className="rounded-buttons border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {batchError ? <p className="mt-3 text-sm text-rose-300">{batchError}</p> : null}
            </div>
          ) : null}

          {pendingDeleteCount > 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-modals border border-amber-500/30 bg-amber-500/10 p-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Pending delete</div>
                <p className="mt-1 text-sm text-amber-100">
                  {pendingDeleteCount} item{pendingDeleteCount === 1 ? "" : "s"} will be permanently deleted in {deleteCountdown}s.
                </p>
              </div>
              <button
                type="button"
                onClick={undoPendingDelete}
                className="rounded-buttons border border-amber-300/40 bg-amber-200/10 px-4 py-2 text-sm font-medium text-amber-100"
              >
                Undo
              </button>
            </div>
          ) : null}

          {mobileTagsOpen ? (
            <div className="mt-3 rounded-modals border border-border bg-surface p-4 xl:hidden">
              <TagCloud
                allTags={allTags}
                selectedTags={selectedTags}
                onToggle={toggleTag}
                onClear={() => setSelectedTags([])}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span>{filteredItems.length} of {items.length} items</span>
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter("all");
                  setSourceFilter("all");
                  setSelectedTags([]);
                  setSelectedFolderId("");
                  setActivePreset("all");
                  if (searchParams.get("source")) {
                    router.replace("/app");
                  }
                }}
                className="rounded-full bg-brand/10 px-3 py-1 text-brand"
              >
                Clear filters
              </button>
            ) : null}
            {surfaceError ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-rose-300">
                {surfaceError}
                <button type="button" onClick={() => void reloadItems()} className="font-medium text-rose-200">
                  Retry
                </button>
              </div>
            ) : null}
          </div>

          <div className={`mt-8 ${gridClass}`}>
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                view={view}
                selectionMode={selectionMode}
                selected={selectedIdSet.has(item.id)}
                onToggleSelect={toggleSelection}
              />
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="mt-8 rounded-modals border border-border bg-surface p-8 text-center">
              <p className="text-sm text-text-mid">No items match the current filters.</p>
              {activeFiltersCount > 0 ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs text-text-muted">
                  {typeFilter !== "all" && <span className="rounded-full border border-border bg-bg px-2 py-1">Type: {typeFilter}</span>}
                  {sourceFilter !== "all" && <span className="rounded-full border border-border bg-bg px-2 py-1">Source: {sourceFilter}</span>}
                  {activePreset !== "all" && <span className="rounded-full border border-border bg-bg px-2 py-1">Preset: {activePreset}</span>}
                  {selectedFolderId && <span className="rounded-full border border-border bg-bg px-2 py-1">Folder: {folderRecords.find(f => f.id === selectedFolderId)?.name ?? "selected"}</span>}
                  {selectedTags.map(tag => <span key={tag} className="rounded-full border border-border bg-bg px-2 py-1">#{tag}</span>)}
                </div>
              ) : null}
              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  className="mt-4 rounded-full bg-brand/10 px-4 py-1.5 text-sm text-brand"
                  onClick={() => {
                    setTypeFilter("all");
                    setSourceFilter("all");
                    setSelectedTags([]);
                    setSelectedFolderId("");
                    setActivePreset("all");
                  }}
                >
                  Clear all filters
                </button>
              ) : null}
            </div>
          ) : null}

          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-buttons border border-border bg-surface px-4 py-2 text-sm text-text-primary transition hover:border-brand/40 disabled:opacity-50"
              >
                {loadingMore ? "Loading more..." : "Load more items"}
              </button>
            </div>
          ) : null}
        </div>

        <aside className={`space-y-4 transition-all duration-300 ${tagsCollapsed ? "invisible opacity-0 xl:translate-x-12" : "visible opacity-100 xl:translate-x-0"}`}>
          <div className="rounded-modals border border-border bg-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-text-primary">Folders</p>
              </div>
              <button
                type="button"
                onClick={() => setTagsCollapsed(true)}
                className="hidden rounded-buttons p-2 text-text-muted hover:bg-surface-2 xl:block"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={folderInput}
                onChange={(event) => setFolderInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void createFolder();
                  }
                }}
                placeholder="New folder"
                className="flex-1 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => void createFolder()}
                disabled={!folderInput.trim() || creatingFolder}
                className="inline-flex items-center gap-2 rounded-buttons bg-brand px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <FolderPlus className="h-4 w-4" />
                {creatingFolder ? "Adding..." : "Add"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedFolderId("")}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  !selectedFolderId
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-bg text-text-mid hover:text-text-primary"
                }`}
              >
                All folders
              </button>
              {foldersWithCounts.map((folder) => {
                const active = selectedFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      active
                        ? "border-brand bg-brand text-white"
                        : "border-border bg-bg text-text-mid hover:text-text-primary"
                    }`}
                    style={!active && folder.color ? { borderColor: `${folder.color}55` } : undefined}
                  >
                    {folder.icon || "folder"} {folder.name} <span className={active ? "text-white/80" : "text-text-muted"}>{folder.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {editingFolderId ? (
            <div className="rounded-modals border border-border bg-surface p-4">
              <div className="mb-4 flex items-center gap-2">
                <FolderCog className="h-4 w-4 text-brand" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Folder style</div>
                  <p className="mt-1 text-sm text-text-primary">Adjust the selected folder’s label, icon, and color.</p>
                </div>
              </div>
              <div className="space-y-3">
                <input
                  value={folderEditName}
                  onChange={(event) => setFolderEditName(event.target.value)}
                  placeholder="Folder name"
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
                />
                <input
                  value={folderEditIcon}
                  onChange={(event) => setFolderEditIcon(event.target.value)}
                  placeholder="Icon text"
                  className="w-full rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
                />
                <div className="flex flex-wrap gap-2">
                  {folderColorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFolderEditColor(color)}
                      className={`h-7 w-7 rounded-full border ${folderEditColor === color ? "border-white" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Select ${color}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void saveFolderCustomization()}
                  disabled={savingFolder}
                  className="w-full rounded-buttons bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingFolder ? "Saving..." : "Save folder"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-modals border border-border bg-surface p-4">
            <TagCloud
              allTags={allTags}
              selectedTags={selectedTags}
              onToggle={toggleTag}
              onClear={() => setSelectedTags([])}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function TagCloud({
  allTags,
  selectedTags,
  onToggle,
  onClear,
}: {
  allTags: Array<{ tag: string; count: number }>;
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text-primary">Tags</p>
        </div>
        {selectedTags.length > 0 ? (
          <button type="button" onClick={onClear} className="text-xs text-brand hover:text-brand-hover">
            Clear
          </button>
        ) : null}
      </div>

      {allTags.length === 0 ? (
        <p className="text-sm text-text-muted">No tags yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allTags.map(({ tag, count }) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggle(tag)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-bg text-text-mid hover:border-brand/40 hover:text-text-primary"
                }`}
              >
                #{tag} <span className={active ? "text-white/80" : "text-text-muted"}>{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
