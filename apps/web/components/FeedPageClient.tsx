"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  Hash,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemCard from "@/components/ItemCard";
import ItemDetailModal from "@/components/ItemDetailModal";
import ControlBar from "@/components/ControlBar";
import { openCreateDialog } from "@/components/CreateItemDialog";
import {
  ARCHIVE_ITEM_CREATED_EVENT,
  ARCHIVE_ITEMS_CHANGED_EVENT,
  dispatchArchiveItemsChanged,
} from "@/lib/archive-events";
import { useFeedKeyboard } from "@/lib/use-feed-keyboard";
import { useStoredState } from "@/lib/hooks";
import type { ArchiveItem, CollectionRecord } from "@/lib/types";

type FeedSort = "newest" | "oldest" | "title";
type FeedType = "all" | "url" | "text" | "note" | "file";
type FeedSource = "all" | "telegram" | "pwa-share" | "email" | "web" | "manual" | "extension" | "mobile";
type StateFilter = "all" | "favorites" | "read-later" | "archived" | "reading" | "read" | "unread" | "broken";
type ItemType = Exclude<FeedType, "all">;
type FeedItem = ArchiveItem & { type: ItemType };
type Folder = CollectionRecord;
type SavedSearch = {
  id: string;
  name: string;
  query: string;
  mode: "hybrid" | "fulltext" | "semantic";
};

const typeOptions: Array<{ label: string; value: FeedType }> = [
  { label: "All types", value: "all" },
  { label: "Links", value: "url" },
  { label: "Text", value: "text" },
  { label: "Notes", value: "note" },
  { label: "Files", value: "file" },
];

const sourceOptions: Array<{ label: string; value: FeedSource }> = [
  { label: "All sources", value: "all" },
  { label: "Telegram", value: "telegram" },
  { label: "Shared", value: "pwa-share" },
  { label: "Email", value: "email" },
  { label: "Web", value: "web" },
  { label: "Manual", value: "manual" },
  { label: "Extension", value: "extension" },
  { label: "Mobile", value: "mobile" },
];

const VISIBLE_TAG_COUNT = 8;

const stateOptions: Array<{ label: string; value: StateFilter }> = [
  { label: "All states", value: "all" },
  { label: "Favorites", value: "favorites" },
  { label: "Read later", value: "read-later" },
  { label: "Archived", value: "archived" },
  { label: "Reading", value: "reading" },
  { label: "Read", value: "read" },
  { label: "Unread", value: "unread" },
  { label: "Broken links", value: "broken" },
];

async function pollUntilEnriched(
  itemId: string,
  setItems: React.Dispatch<React.SetStateAction<FeedItem[]>>,
) {
  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, Math.min(2000 * Math.pow(1.5, i), 30000)));
    try {
      const res = await fetch(`/api/items/${itemId}`);
      if (!res.ok) break;
      const data = (await res.json()) as { item?: FeedItem };
      if (data.item?.enriched) {
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, ...data.item! } : it)),
        );
        break;
      }
    } catch {
      break;
    }
  }
}

export default function FeedPageClient({
  initialItems,
  folders,
  initialHasMore,
  initialNextCursor,
  searchQuery = "",
}: {
  initialItems: FeedItem[];
  folders: Folder[];
  initialHasMore: boolean;
  initialNextCursor: string | null;
  searchQuery?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [folderRecords, setFolderRecords] = useState<Folder[]>(folders);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchName, setSaveSearchName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);

  // Filter state.
  const [sort, setSort] = useState<FeedSort>("newest");
  const [typeFilter, setTypeFilter] = useState<FeedType>("all");
  const [sourceFilter, setSourceFilter] = useState<FeedSource>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [tagsExpanded, setTagsExpanded] = useState(false);

  // Masonry column count (persisted).
  const [cols, setCols] = useStoredState("recall-cols", 4);

  // Mobile detection.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const effectiveCols = isMobile ? 2 : cols;

  // Inline create folder.
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderInput, setFolderInput] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Selection + batch.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkFolderId, setBulkFolderId] = useState("");
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [bulkReminderAt, setBulkReminderAt] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const countdownRef = useRef<number | null>(null);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const deleteTimeoutRef = useRef<number | null>(null);
  const pendingDeleteRef = useRef<{ ids: string[]; previousItems: FeedItem[] } | null>(null);

  // Modal lifted out of ItemCard so keyboard shortcut `e` / Enter can drive
  // the same UI as a mouse click. One modal per page instead of N.
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    setItems(initialItems);
    setFolderRecords(folders);
    setHasMore(initialHasMore);
    setNextCursor(initialNextCursor);
  }, [folders, initialHasMore, initialItems, initialNextCursor]);

  useEffect(() => {
    void fetch("/api/v1/search/saved")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { smartSearches?: SavedSearch[] };
        setSavedSearches(data.smartSearches ?? []);
      })
      .catch(() => undefined);
  }, []);

  // Honour ?source=… deep links into the feed (e.g. from the Telegram bot's
  // "view in app" reply).
  useEffect(() => {
    const source = searchParams.get("source");
    const sources: FeedSource[] = ["telegram", "pwa-share", "email", "web", "manual", "extension", "mobile"];
    if (source && sources.includes(source as FeedSource)) {
      setSourceFilter(source as FeedSource);
    } else {
      setSourceFilter("all");
    }
  }, [searchParams]);

  useEffect(() => {
    function handleCreated(event: Event) {
      const detail = (event as CustomEvent<{ itemId?: string }>).detail;
      const itemId = detail?.itemId;
      if (!itemId) return;
      void fetch(`/api/items/${itemId}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("Failed to load item");
          return (await response.json()) as { item?: FeedItem };
        })
        .then((data) => {
          if (!data.item) return;
          setItems((current) => [data.item!, ...current.filter((item) => item.id !== data.item!.id)]);
          // Start polling until enrichment completes.
          void pollUntilEnriched(itemId, setItems);
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
    const url = searchQuery
      ? `/api/search?q=${encodeURIComponent(searchQuery)}&limit=50`
      : "/api/items?limit=50";
    const response = await fetch(url);
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

  // Derived: top tags by frequency across the current item set.
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

  const filteredItems = useMemo(() => {
    const next = items.filter((item) => {
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => (item.tags || []).includes(tag));
      const matchesFolder = !selectedFolderId || item.collection_id === selectedFolderId;
      const matchesState =
        stateFilter === "all" ||
        (stateFilter === "favorites" && item.is_favorite) ||
        (stateFilter === "read-later" && item.is_read_later) ||
        (stateFilter === "archived" && item.is_archived) ||
        (stateFilter === "reading" && item.reading_state === "reading") ||
        (stateFilter === "read" && item.reading_state === "read") ||
        (stateFilter === "unread" && (!item.reading_state || item.reading_state === "unread")) ||
        (stateFilter === "broken" && item.link_broken);
      return matchesType && matchesSource && matchesTags && matchesFolder && matchesState;
    });

    next.sort((a, b) => {
      if (sort === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === "title") {
        const titleA = (a.title || a.raw_url || a.file_name || a.raw_text || "").toLowerCase();
        const titleB = (b.title || b.raw_url || b.file_name || b.raw_text || "").toLowerCase();
        return titleA.localeCompare(titleB);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return next;
  }, [items, selectedTags, selectedFolderId, sort, sourceFilter, stateFilter, typeFilter]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (typeFilter !== "all") {
      const label = typeOptions.find((o) => o.value === typeFilter)?.label ?? typeFilter;
      chips.push({ key: "type", label: `Type: ${label}`, clear: () => setTypeFilter("all") });
    }
    if (sourceFilter !== "all") {
      const label = sourceOptions.find((o) => o.value === sourceFilter)?.label ?? sourceFilter;
      chips.push({ key: "source", label: `Source: ${label}`, clear: () => setSourceFilter("all") });
    }
    if (selectedFolderId) {
      const folder = folderRecords.find((f) => f.id === selectedFolderId);
      chips.push({ key: "folder", label: `Folder: ${folder?.name ?? "—"}`, clear: () => setSelectedFolderId("") });
    }
    if (stateFilter !== "all") {
      const label = stateOptions.find((option) => option.value === stateFilter)?.label ?? stateFilter;
      chips.push({ key: "state", label: `State: ${label}`, clear: () => setStateFilter("all") });
    }
    for (const tag of selectedTags) {
      chips.push({
        key: `tag-${tag}`,
        label: `#${tag}`,
        clear: () => setSelectedTags((current) => current.filter((t) => t !== tag)),
      });
    }
    return chips;
  }, [folderRecords, selectedFolderId, selectedTags, sourceFilter, stateFilter, typeFilter]);

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
    if (!name || creatingFolder) return;
    setCreatingFolder(true);
    setSurfaceError(null);
    try {
      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon: "folder", color: "#6366f1" }),
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
      setShowFolderForm(false);
      dispatchArchiveItemsChanged();
    } finally {
      setCreatingFolder(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setSurfaceError(null);
    try {
      const response = await fetch(
        searchQuery
          ? `/api/search?q=${encodeURIComponent(searchQuery)}&limit=50&cursor=${encodeURIComponent(nextCursor)}`
          : `/api/items?limit=50&cursor=${encodeURIComponent(nextCursor)}`,
      );
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

  async function saveCurrentSearch() {
    const query = searchQuery.trim();
    const name = saveSearchName.trim() || query.slice(0, 80);
    if (!query || savingSearch) return;

    setSavingSearch(true);
    setSurfaceError(null);
    try {
      const response = await fetch("/api/v1/search/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, query, mode: "hybrid" }),
      });
      if (!response.ok) {
        setSurfaceError(response.status === 409 ? "That saved search name already exists." : "The search could not be saved.");
        return;
      }
      const data = (await response.json()) as { smartSearch?: SavedSearch };
      if (data.smartSearch) {
        setSavedSearches((current) => [
          data.smartSearch!,
          ...current.filter((entry) => entry.id !== data.smartSearch!.id),
        ]);
      }
      setSaveSearchName("");
    } finally {
      setSavingSearch(false);
    }
  }

  async function deleteSavedSearch(id: string) {
    setSavedSearches((current) => current.filter((entry) => entry.id !== id));
    await fetch(`/api/v1/search/saved/${id}`, { method: "DELETE" }).catch(() => undefined);
  }

  async function applyBatchAction(kind: "update" | "delete") {
    if (selectedIds.length === 0 || batchLoading) return;

    if (kind === "delete") {
      if (deleteTimeoutRef.current) window.clearTimeout(deleteTimeoutRef.current);
      pendingDeleteRef.current = { ids: selectedIds, previousItems: items };
      setItems((current) => current.filter((item) => !selectedIdSet.has(item.id)));
      setPendingDeleteCount(selectedIds.length);
      setBatchError(null);
      resetSelection();

      setDeleteCountdown(5);
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = window.setInterval(() => {
        setDeleteCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              window.clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      deleteTimeoutRef.current = window.setTimeout(async () => {
        const pendingDelete = pendingDeleteRef.current;
        if (!pendingDelete) return;
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
        reminder_at: bulkReminderAt
          ? new Date(bulkReminderAt).toISOString()
          : bulkReminderAt === ""
            ? null
            : undefined,
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
                collection_name:
                  action.collection_id !== undefined ? selectedFolder?.name || null : item.collection_name,
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
    if (!pendingDelete) return;
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

  // Quick reminder ("tomorrow 9 AM") fires from the keyboard `r` shortcut on
  // the focused card.
  async function quickReminder(itemId: string) {
    const remindAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    remindAt.setHours(9, 0, 0, 0);
    await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminder_at: remindAt.toISOString() }),
    });
    dispatchArchiveItemsChanged();
  }

  // Listen for `?` to toggle the keyboard help overlay.
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setShowShortcuts((v) => !v);
      } else if (event.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showShortcuts]);

  const visibleTags = tagsExpanded ? allTags : allTags.slice(0, VISIBLE_TAG_COUNT);

  const { focusedIndex, keyboardActive, deactivateOnPointer } = useFeedKeyboard({
    itemCount: filteredItems.length,
    onOpen: (index) => {
      const item = filteredItems[index];
      if (item) setOpenItemId(item.id);
    },
    onRemind: (index) => {
      const item = filteredItems[index];
      if (item) void quickReminder(item.id);
    },
    onCapture: () => openCreateDialog(),
  });
  const deactivateKeyboard = deactivateOnPointer;

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "4px 18px 80px" }}>
      {/* Header */}
      {searchQuery ? (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-text-primary">Search results</h1>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-sm">
              <Search className="h-3.5 w-3.5 text-brand" />
              <span className="text-text-primary">&ldquo;{searchQuery}&rdquo;</span>
              <button
                type="button"
                onClick={() => router.push("/app")}
                className="rounded-full p-0.5 text-brand hover:bg-brand/20"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={saveSearchName}
              onChange={(event) => setSaveSearchName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveCurrentSearch();
              }}
              placeholder="Saved search name"
              className="min-w-0 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-brand"
            />
            <button
              type="button"
              onClick={() => void saveCurrentSearch()}
              disabled={savingSearch}
              className="inline-flex items-center gap-2 rounded-buttons border border-brand/40 bg-brand/10 px-3 py-2 text-sm font-medium text-brand transition hover:bg-brand/20 disabled:opacity-50"
            >
              <BookmarkPlus className="h-4 w-4" />
              {savingSearch ? "Saving" : "Save search"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Your archive</h1>
          <span className="text-xs text-text-muted">
            {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
            {filteredItems.length !== items.length ? <> of {items.length}</> : null}
          </span>
        </div>
      )}

      {savedSearches.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] uppercase tracking-[0.18em] text-text-muted">Smart searches</span>
          {savedSearches.slice(0, 10).map((savedSearch) => {
            const active = searchQuery === savedSearch.query;
            return (
              <span
                key={savedSearch.id}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-bg text-text-mid"
                }`}
              >
                <button
                  type="button"
                  onClick={() => router.push(`/app?q=${encodeURIComponent(savedSearch.query)}`)}
                  className={active ? "text-white" : "hover:text-text-primary"}
                >
                  {savedSearch.name}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSavedSearch(savedSearch.id)}
                  aria-label={`Delete saved search ${savedSearch.name}`}
                  className={active ? "text-white/80 hover:text-white" : "text-text-muted hover:text-rose-300"}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* ControlBar — replaces the old inline filter row */}
      <ControlBar
        cols={cols}
        setCols={setCols}
        query=""
        setQuery={() => undefined}
        sort={sort}
        setSort={(s) => setSort(s as FeedSort)}
        folder={selectedFolderId}
        setFolder={setSelectedFolderId}
        source={sourceFilter === "all" ? "" : sourceFilter}
        setSource={(v) => setSourceFilter(v === "" ? "all" : (v as FeedSource))}
        itemType={typeFilter === "all" ? "" : typeFilter}
        setItemType={(v) => setTypeFilter(v === "" ? "all" : (v as FeedType))}
        selectionMode={selectionMode}
        setSelectionMode={(v) => {
          if (!v) resetSelection();
          else setSelectionMode(true);
        }}
        onAddFolder={() => setShowFolderForm((prev) => !prev)}
        folders={folderRecords}
      />

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {stateOptions.map((option) => {
          const active = stateFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setStateFilter(option.value)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-bg text-text-mid hover:border-brand/40 hover:text-text-primary"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Inline new folder form */}
      {showFolderForm ? (
        <div className="mt-3 flex items-center gap-2 rounded-buttons border border-border bg-surface px-3 py-2">
          <input
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createFolder();
              if (e.key === "Escape") {
                setShowFolderForm(false);
                setFolderInput("");
              }
            }}
            placeholder="Folder name"
            autoFocus
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={() => void createFolder()}
            disabled={!folderInput.trim() || creatingFolder}
            className="rounded-buttons bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {creatingFolder ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowFolderForm(false);
              setFolderInput("");
            }}
            className="rounded-buttons p-1.5 text-text-muted hover:bg-surface-2"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <span className="hidden text-[10px] text-text-muted sm:inline">
            Manage all folders in Settings
          </span>
        </div>
      ) : null}

      {/* Active filter chips */}
      {activeFilters.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {activeFilters.map(({ key, label, clear }) => (
            <button
              key={key}
              type="button"
              onClick={clear}
              className="group inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] text-brand transition hover:bg-brand/20"
            >
              {label}
              <X className="h-3 w-3 transition group-hover:text-rose-300" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setTypeFilter("all");
              setSourceFilter("all");
              setSelectedTags([]);
              setSelectedFolderId("");
              setStateFilter("all");
            }}
            className="ml-1 rounded-full px-2.5 py-1 text-[11px] text-text-muted hover:text-text-primary"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {/* Tag chip rail */}
      {allTags.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          {visibleTags.map(({ tag, count }) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-bg text-text-mid hover:border-brand/40 hover:text-text-primary"
                }`}
              >
                #{tag} <span className={active ? "text-white/80" : "text-text-muted"}>{count}</span>
              </button>
            );
          })}
          {allTags.length > VISIBLE_TAG_COUNT ? (
            <button
              type="button"
              onClick={() => setTagsExpanded((v) => !v)}
              className="rounded-full px-2 py-1 text-[11px] text-text-muted hover:text-text-primary"
            >
              {tagsExpanded ? "Less" : `+${allTags.length - VISIBLE_TAG_COUNT} more`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Selection panel */}
      {selectionMode ? (
        <div className="mt-4 rounded-modals border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-primary">
              {selectedIds.length > 0
                ? `${selectedIds.length} ${selectedIds.length === 1 ? "item" : "items"} selected`
                : "Select items to apply a bulk action"}
            </p>
            {selectedIds.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedIds(filteredItems.map((item) => item.id))}
                className="text-xs text-brand hover:text-brand-hover"
              >
                Select all filtered ({filteredItems.length})
              </button>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
            <select
              value={bulkFolderId}
              onChange={(event) => setBulkFolderId(event.target.value)}
              className="rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
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
              className="rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
            />
            <input
              type="datetime-local"
              value={bulkReminderAt}
              onChange={(event) => setBulkReminderAt(event.target.value)}
              className="rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
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
                className="rounded-buttons border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 disabled:opacity-50"
                aria-label="Delete selected"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {batchError ? <p className="mt-3 text-sm text-rose-300">{batchError}</p> : null}
        </div>
      ) : null}

      {/* Pending delete undo */}
      {pendingDeleteCount > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-modals border border-amber-500/30 bg-amber-500/10 p-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Pending delete</div>
            <p className="mt-1 text-sm text-amber-100">
              {pendingDeleteCount} {pendingDeleteCount === 1 ? "item" : "items"} will be permanently deleted in {deleteCountdown}s.
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

      {surfaceError ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
          {surfaceError}
          <button type="button" onClick={() => void reloadItems()} className="font-medium text-rose-200">
            Retry
          </button>
        </div>
      ) : null}

      {/* Masonry grid */}
      {filteredItems.length > 0 ? (
        <div
          style={{ columnCount: effectiveCols, columnGap: 14, marginTop: 6 }}
          onPointerMove={deactivateKeyboard}
        >
          {filteredItems.map((item, index) => (
            <div key={item.id} style={{ breakInside: "avoid", marginBottom: 14 }}>
              <ItemCard
                item={item}
                index={index}
                focused={keyboardActive && focusedIndex === index}
                selectionMode={selectionMode}
                selected={selectedIdSet.has(item.id)}
                isMobile={isMobile}
                onOpen={(id) => setOpenItemId(id)}
                onToggleSelect={toggleSelection}
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            color: "var(--color-text-muted, #8b949e)",
            fontSize: 14,
            padding: "48px 0",
          }}
        >
          {searchQuery
            ? "No matches for that meaning. Try describing it differently."
            : items.length === 0
              ? "Nothing captured yet. Paste a link or jot a thought above to begin."
              : "No items match the current filters."}
          {!searchQuery && activeFilters.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="rounded-full bg-brand/10 px-4 py-1.5 text-sm text-brand"
                onClick={() => {
                  setTypeFilter("all");
                  setSourceFilter("all");
                  setSelectedTags([]);
                  setSelectedFolderId("");
                  setStateFilter("all");
                }}
              >
                Clear all filters
              </button>
            </div>
          ) : null}
          {searchQuery ? (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={() => router.push("/app")}
                className="rounded-full bg-brand/10 px-4 py-1.5 text-sm text-brand"
              >
                Clear search
              </button>
            </div>
          ) : null}
        </div>
      )}

      {hasMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-buttons border border-border bg-surface px-4 py-2 text-sm text-text-primary transition hover:border-brand/40 disabled:opacity-50"
          >
            {loadingMore ? "Loading more…" : "Load more"}
          </button>
        </div>
      ) : null}

      {/* Lifted modal — single instance, opened either by card click or by
          keyboard `e` / Enter on the focused card. */}
      <ItemDetailModal
        itemId={openItemId ?? ""}
        open={openItemId !== null}
        onClose={() => setOpenItemId(null)}
      />

      {/* Keyboard help overlay (press `?` to toggle). */}
      {showShortcuts ? (
        <div
          role="dialog"
          aria-label="Keyboard shortcuts"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-modals border border-border bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
                Keyboard
              </h2>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="rounded-buttons p-1.5 text-text-muted hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {[
                { keys: ["j", "↓"], label: "Next item" },
                { keys: ["k", "↑"], label: "Previous item" },
                { keys: ["Enter", "e"], label: "Open item detail" },
                { keys: ["r"], label: "Remind tomorrow 9 AM" },
                { keys: ["c"], label: "New capture" },
                { keys: ["/"], label: "Focus search" },
                { keys: ["?"], label: "Toggle this help" },
                { keys: ["Esc"], label: "Close / exit" },
              ].map(({ keys, label }) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span className="text-text-mid">{label}</span>
                  <span className="flex items-center gap-1">
                    {keys.map((k) => (
                      <kbd
                        key={k}
                        className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-bg px-1.5 font-mono text-[11px] text-text-primary"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
