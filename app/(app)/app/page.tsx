import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import FeedPageClient from "@/components/FeedPageClient";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const INITIAL_ITEMS_LIMIT = 50;

async function getItems(userId: string) {
  const result = await db.query(
    `SELECT items.id,
            items.type,
            items.title,
            items.summary,
            items.tags,
            items.source,
            items.created_at,
            items.updated_at,
            items.raw_url,
            LEFT(items.raw_text, 240) AS raw_text,
            items.collection_id,
            collections.name AS collection_name,
            items.canvas_x,
            items.canvas_y,
            items.canvas_pinned,
            items.enriched,
            items.reminder_at,
            items.reminder_sent,
            items.file_name,
            items.file_mime_type,
            items.image_url
     FROM items
     LEFT JOIN collections ON collections.id = items.collection_id
     WHERE items.user_id = $1
     ORDER BY items.created_at DESC
     LIMIT $2`,
    [userId, INITIAL_ITEMS_LIMIT + 1]
  );

  const hasMore = result.rows.length > INITIAL_ITEMS_LIMIT;
  const items = hasMore ? result.rows.slice(0, INITIAL_ITEMS_LIMIT) : result.rows;

  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

async function getFolders(userId: string) {
  const result = await db.query(
    "SELECT * FROM collections WHERE user_id = $1 ORDER BY name ASC",
    [userId],
  );
  return result.rows;
}

export default async function AppFeedPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await auth();
  const { items, hasMore, nextCursor } = await getItems(session!.user!.id!);
  const folders = await getFolders(session!.user!.id!);
  const params = await searchParams;
  const saved = params?.saved === "true";
  const error = params?.error;

  return (
    <div>
      {saved && (
        <div className="mx-auto mt-6 max-w-7xl rounded-buttons border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-text-primary">
          Saved to Recall. Enrichment is queued in the background.
        </div>
      )}
      {error && (
        <div className="mx-auto mt-6 max-w-7xl rounded-buttons border border-border bg-surface px-4 py-3 text-sm text-text-mid">
          {error === "unsupported_file_type"
            ? "That file type is not supported yet."
            : error === "limit_reached"
              ? "You have reached your current plan limit for new saves."
              : "The last save attempt did not complete."}
        </div>
      )}

      {items.length === 0 ? (
        <>
          <FeedPageClient initialItems={[]} folders={folders} initialHasMore={false} initialNextCursor={null} />
          <div className="mx-auto mt-2 max-w-7xl px-5 pb-8">
            <div className="flex flex-col items-center justify-center rounded-modals border border-border bg-surface p-12 text-center">
              <div className="mb-4 rounded-full bg-surface-2 p-3 text-text-muted">
                <Plus className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">Your library is empty</h3>
              <p className="text-sm text-text-mid">Save links, notes or files to get started.</p>
            </div>
          </div>
        </>
      ) : (
        <FeedPageClient
          initialItems={items}
          folders={folders}
          initialHasMore={hasMore}
          initialNextCursor={nextCursor}
        />
      )}
    </div>
  );
}
