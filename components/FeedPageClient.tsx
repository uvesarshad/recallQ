"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDownAZ, ChevronLeft, ChevronRight, FolderPlus, Funnel, Grid2X2, Hash, Rows2, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemCard from "@/components/ItemCard";
import Tooltip from "@/components/Tooltip";
import { useStoredState } from "@/lib/hooks";

type FeedView = "grid" | "list";
type FeedSort = "newest" | "oldest" | "title";
type FeedType = "all" | "url" | "text" | "note" | "file";
type FeedSource = "all" | "telegram" | "pwa-share" | "email" | "web" | "manual";
type ItemType = Exclude<FeedType, "all">;

type FeedItem = {
  id: string;
  type: ItemType;
  title?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  source?: string | null;
  created_at: string;
  updated_at?: string;
  raw_url?: string | null;
  raw_text?: string | null;
  collection_id?: string | null;
  collection_name?: string | null;
  canvas_x?: number | null;
  canvas_y?: number | null;
  canvas_pinned?: boolean;
  enriched?: boolean;
  reminder_at?: string | null;
  reminder_sent?: boolean;
  file_name?: string | null;
  file_mime_type?: string | null;
  image_url?: string | null;
  snippet?: string;
};

type Folder = {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
};

function useStoredView(defaultView: FeedView) {
  const [view, setView] = useState<FeedView>(defaultView);

  useEffect(() => {
    const stored = window.localStorage.getItem("recall-feed-view");
    if (stored === "grid" || stored === "list") {
      setView(stored);
    }
  }, []);

  function update(next: FeedView) {
    setView(next);
    window.localStorage.setItem("recall-feed-view", next);
  }

  return [view, update] as const;
}

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
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useStoredView("list");
  const [sort, setSort] = useState<FeedSort>("newest");
  const [typeFilter, setTypeFilter] = useState<FeedType>("all");
  const [sourceFilter, setSourceFilter] = useState<FeedSource>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [mobileTagsOpen, setMobileTagsOpen] = useState(false);
  const [tagsCollapsed, setTagsCollapsed] = useStoredState("recall-tags-collapsed", false);
  const [folderInput, setFolderInput] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
    setHasMore(initialHasMore);
    setNextCursor(initialNextCursor);
  }, [initialHasMore, initialItems, initialNextCursor]);

  useEffect(() => {
    const source = searchParams.get("source");
    if (source === "telegram" || source === "pwa-share" || source === "email" || source === "web" || source === "manual") {
      setSourceFilter(source);
      return;
    }

    setSourceFilter("all");
  }, [searchParams]);

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

    return folders.map((folder) => ({
      ...folder,
      count: counts.get(folder.id) || 0,
    }));
  }, [folders, items]);

  const filteredItems = useMemo(() => {
    const next = items.filter((item) => {
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => (item.tags || []).includes(tag));
      const matchesFolder = !selectedFolderId || item.collection_id === selectedFolderId;

      return matchesType && matchesSource && matchesTags && matchesFolder;
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
  }, [items, selectedTags, selectedFolderId, sort, sourceFilter, typeFilter]);

  const gridClass = useMemo(
    () => (view === "grid" ? "grid gap-4 md:grid-cols-2" : "space-y-4"),
    [view],
  );

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag],
    );
  }

  async function createFolder() {
    const name = folderInput.trim();
    if (!name || isPending) {
      return;
    }

    const response = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon: "📁" }),
    });

    if (!response.ok) {
      return;
    }

    setFolderInput("");
    startTransition(() => {
      router.refresh();
    });
  }

  const activeFiltersCount =
    (typeFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    selectedTags.length +
    (selectedFolderId ? 1 : 0);

  async function loadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      const response = await fetch(`/api/items?limit=50&cursor=${encodeURIComponent(nextCursor)}`);
      if (!response.ok) {
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

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs text-brand">
            <Sparkles className="h-3 w-3" />
            Capture, organize, recall
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Your archive</h1>
          <p className="text-sm text-text-muted">Sort the archive, filter by type, and organize everything into folders without overloading the header.</p>
        </div>
        {tagsCollapsed ? (
          <div className="hidden xl:block">
            <Tooltip content="Expand sidebar" position="left">
              <button
                onClick={() => setTagsCollapsed(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white shadow-brand-glow shadow-md transition-transform hover:scale-105 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>

      <div className={`grid gap-6 transition-all duration-300 ${tagsCollapsed ? "xl:grid-cols-[1fr_0rem]" : "xl:grid-cols-[minmax(0,1fr)_18rem]"}`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 rounded-modals border border-border bg-surface p-3">
            <label className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-sm text-text-mid">
              <Funnel className="h-4 w-4 text-brand" />
              <span className="text-text-muted">Type</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as FeedType)}
                className="bg-transparent text-text-primary outline-none"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-surface text-text-primary">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-sm text-text-mid">
              <ArrowDownAZ className="h-4 w-4 text-brand" />
              <span className="text-text-muted">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as FeedSort)}
                className="bg-transparent text-text-primary outline-none"
              >
                <option value="newest" className="bg-surface text-text-primary">Newest</option>
                <option value="oldest" className="bg-surface text-text-primary">Oldest</option>
                <option value="title" className="bg-surface text-text-primary">Title A-Z</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-sm text-text-mid">
              <span className="text-text-muted">Source</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as FeedSource)}
                className="bg-transparent text-text-primary outline-none"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value} className="bg-surface text-text-primary">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-sm text-text-mid">
              <span className="text-text-muted">Folder</span>
              <select
                value={selectedFolderId}
                onChange={(e) => setSelectedFolderId(e.target.value)}
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
              className="inline-flex items-center gap-2 rounded-buttons border border-border bg-bg px-3 py-2 text-sm text-text-mid hover:text-text-primary xl:hidden"
            >
              <Hash className="h-4 w-4 text-brand" />
              Tags
              {selectedTags.length > 0 ? (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{selectedTags.length}</span>
              ) : null}
            </button>

            <div className="ml-auto flex items-center gap-2 rounded-buttons border border-border bg-bg p-1">
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
                  if (searchParams.get("source")) {
                    router.replace("/app");
                  }
                }}
                className="rounded-full bg-brand/10 px-3 py-1 text-brand"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div className={`mt-8 ${gridClass}`}>
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} view={view} />
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="mt-8 rounded-modals border border-border bg-surface p-8 text-center text-sm text-text-mid">
              No items match the current filters.
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
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Folders</div>
                <p className="mt-1 text-sm text-text-primary">Pin the archive into named buckets.</p>
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
                onChange={(e) => setFolderInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void createFolder();
                  }
                }}
                placeholder="New folder"
                className="flex-1 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => void createFolder()}
                disabled={!folderInput.trim() || isPending}
                className="inline-flex items-center gap-2 rounded-buttons bg-brand px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <FolderPlus className="h-4 w-4" />
                Add
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
                  >
                    {folder.icon || "📁"} {folder.name} <span className={active ? "text-white/80" : "text-text-muted"}>{folder.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Tag cloud</div>
          <p className="mt-1 text-sm text-text-primary">Use tags as a secondary filter rail.</p>
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
