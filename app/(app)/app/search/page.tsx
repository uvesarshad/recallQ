"use client";

import { useState, useEffect } from "react";
import ItemCard from "@/components/ItemCard";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [exactMatches, setExactMatches] = useState<any[]>([]);
  const [semanticMatches, setSemanticMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setExactMatches([]);
        setSemanticMatches([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=hybrid`);
        const data = await res.json();
        setExactMatches(data.exact || []);
        setSemanticMatches(data.semantic || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Search results</h1>
        <p className="mt-1 text-sm text-text-muted">
          Use the global search bar in the header to search your archive.
        </p>
        {query ? (
          <div className="mt-4 rounded-buttons border border-border bg-surface px-4 py-3 text-sm text-text-primary">
            Query: {query}
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        )}

        {!loading && query && exactMatches.length === 0 && semanticMatches.length === 0 && (
          <div className="text-center py-12 border border-dashed border-border rounded-modals">
            <p className="text-sm text-text-mid">No items found matching "{query}"</p>
          </div>
        )}

        {!loading && exactMatches.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-text-muted mb-3">Exact matches</h2>
            <div className="space-y-3">
              {exactMatches.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {!loading && semanticMatches.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-text-muted mb-3">Similar content</h2>
            <div className="space-y-3">
              {semanticMatches.map((item) => (
                <ItemCard key={item.id} item={item} highlight={item.similarity ? `Similarity: ${(item.similarity * 100).toFixed(0)}%` : undefined} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
