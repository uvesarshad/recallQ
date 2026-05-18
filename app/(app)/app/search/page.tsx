"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemCard from "@/components/ItemCard";
import { ARCHIVE_ITEM_CREATED_EVENT, ARCHIVE_ITEMS_CHANGED_EVENT } from "@/lib/archive-events";
import { getMatchReasons } from "@/lib/search-explain";
import type { ArchiveItem } from "@/lib/types";

const suggestedQueries = [
  "things I saved this week",
  "pricing pages and competitors",
  "notes about product design",
];

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [exactMatches, setExactMatches] = useState<ArchiveItem[]>([]);
  const [semanticMatches, setSemanticMatches] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setExactMatches([]);
        setSemanticMatches([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=hybrid`);
        if (!res.ok) {
          setExactMatches([]);
          setSemanticMatches([]);
          setError("Search is unavailable right now.");
          return;
        }
        const data = (await res.json()) as { exact?: ArchiveItem[]; semantic?: ArchiveItem[] };
        setExactMatches(data.exact || []);
        setSemanticMatches(data.semantic || []);
      } catch {
        setError("Search is unavailable right now.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, refreshNonce]);

  useEffect(() => {
    const rerun = () => {
      if (query.trim()) {
        setRefreshNonce((current) => current + 1);
      }
    };

    window.addEventListener(ARCHIVE_ITEM_CREATED_EVENT, rerun);
    window.addEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, rerun);
    return () => {
      window.removeEventListener(ARCHIVE_ITEM_CREATED_EVENT, rerun);
      window.removeEventListener(ARCHIVE_ITEMS_CHANGED_EVENT, rerun);
    };
  }, [query]);

  const semanticOnlyMatches = useMemo(() => {
    const exactIds = new Set(exactMatches.map((item) => item.id));
    return semanticMatches.filter((item) => !exactIds.has(item.id));
  }, [exactMatches, semanticMatches]);

  const totalMatches = exactMatches.length + semanticOnlyMatches.length;

  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <section className="rounded-modals border border-border bg-surface p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs text-brand">
              <Sparkles className="h-3 w-3" />
              Hybrid retrieval
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Search your archive</h1>
            <p className="mt-1 text-sm text-text-muted">
              Keyword matches stay separate from semantic matches so you can see exactly why something showed up.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-cards border border-border bg-bg px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Total</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">{totalMatches}</div>
            </div>
            <div className="rounded-cards border border-border bg-bg px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Exact</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">{exactMatches.length}</div>
            </div>
            <div className="rounded-cards border border-border bg-bg px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Semantic</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">{semanticOnlyMatches.length}</div>
            </div>
          </div>
        </div>

        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            router.replace(query.trim() ? `/app/search?q=${encodeURIComponent(query.trim())}` : "/app/search");
          }}
        >
          <div className="flex flex-1 items-center gap-3 rounded-input border border-border bg-bg px-4 py-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand-glow">
            <Search className="h-4 w-4 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by words, ideas, topics, or a phrase from memory"
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-buttons bg-brand px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-hover"
          >
            Search
          </button>
        </form>

        {!query ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-cards border border-border bg-bg p-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">How to search</div>
              <div className="mt-3 space-y-2 text-sm text-text-mid">
                <p>Use exact phrases for titles and copied text.</p>
                <p>Use broader language when you only remember the idea or topic.</p>
                <p>Search works best when enrichment has already finished on the saved items.</p>
              </div>
            </div>
            <div className="rounded-cards border border-border bg-bg p-5">
              <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-text-muted">Try these</div>
              <div className="flex flex-wrap gap-2">
                {suggestedQueries.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setQuery(suggestion);
                      router.replace(`/app/search?q=${encodeURIComponent(suggestion)}`);
                    }}
                    className="rounded-full border border-border bg-surface px-3 py-2 text-sm text-text-primary transition hover:border-brand/40 hover:bg-brand/80 hover:text-white"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 flex items-center justify-center rounded-cards border border-border bg-bg py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-cards border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && !error && query && totalMatches === 0 ? (
          <div className="mt-6 rounded-cards border border-dashed border-border bg-bg px-6 py-12 text-center">
            <p className="text-base font-medium text-text-primary">No results for &quot;{query}&quot;</p>
            <p className="mt-2 text-sm text-text-muted">Try a shorter phrase, a tag-like keyword, or a more conceptual prompt.</p>
          </div>
        ) : null}

        {!loading && !error && totalMatches > 0 ? (
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <section className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-text-muted">Exact matches</h2>
                <span className="text-xs text-text-muted">{exactMatches.length}</span>
              </div>
              <div className="space-y-3">
                {exactMatches.length > 0 ? (
                  exactMatches.map((item) => {
                    const reasons = getMatchReasons(query, item);
                    return (
                      <ItemCard
                        key={item.id}
                        item={item}
                        highlight={reasons.length > 0 ? reasons.join(" · ") : "Exact match"}
                      />
                    );
                  })
                ) : (
                  <div className="rounded-cards border border-border bg-bg px-4 py-6 text-sm text-text-muted">
                    No full-text matches in titles, summaries, or raw text.
                  </div>
                )}
              </div>
            </section>

            <section className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-text-muted">Similar content</h2>
                <span className="text-xs text-text-muted">{semanticOnlyMatches.length}</span>
              </div>
              <div className="space-y-3">
                {semanticOnlyMatches.length > 0 ? (
                  semanticOnlyMatches.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      highlight={item.similarity ? `Similarity ${Math.round(item.similarity * 100)}%` : undefined}
                    />
                  ))
                ) : (
                  <div className="rounded-cards border border-border bg-bg px-4 py-6 text-sm text-text-muted">
                    No additional semantic matches surfaced for this query.
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
