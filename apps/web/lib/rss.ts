import { db } from "./db";
import { ingestItem } from "./ingest";
import { enqueueJob } from "./jobs";
import { parseFeedXml, type ParsedFeed, type ParsedFeedEntry } from "./rss-parser";
import { safeFetch } from "./url-safety";

export { parseFeedXml, type ParsedFeed, type ParsedFeedEntry };

type RssFeedRow = {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  collection_id: string | null;
  poll_interval_minutes: number;
};

export async function fetchFeed(url: string) {
  const response = await safeFetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`Feed fetch failed with ${response.status}`);
  }
  const xml = await response.text();
  return parseFeedXml(xml, url);
}

export async function enqueueDueRssFeeds(limit = 20) {
  const result = await db.query<{ id: string; user_id: string }>(
    `UPDATE rss_feeds
     SET next_fetch_at = NOW() + (poll_interval_minutes * INTERVAL '1 minute'),
         updated_at = NOW()
     WHERE id IN (
       SELECT id
       FROM rss_feeds
       WHERE enabled = TRUE
         AND next_fetch_at <= NOW()
       ORDER BY next_fetch_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, user_id`,
    [limit],
  );

  for (const feed of result.rows) {
    await enqueueJob({
      type: "import",
      userId: feed.user_id,
      payload: { kind: "rss_feed", feedId: feed.id },
    });
  }

  return result.rows.length;
}

export async function syncRssFeed(feedId: string) {
  const feedResult = await db.query<RssFeedRow>(
    `SELECT id, user_id, url, title, collection_id, poll_interval_minutes
     FROM rss_feeds
     WHERE id = $1`,
    [feedId],
  );
  const feed = feedResult.rows[0];
  if (!feed) {
    throw new Error("RSS feed not found");
  }

  try {
    const parsed = await fetchFeed(feed.url);
    let imported = 0;
    let duplicate = 0;

    if (parsed.title && parsed.title !== feed.title) {
      await db.query("UPDATE rss_feeds SET title = $1, updated_at = NOW() WHERE id = $2", [parsed.title, feed.id]);
    }

    for (const entry of parsed.entries) {
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO rss_feed_entries (feed_id, user_id, entry_key, url, title, published_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (feed_id, entry_key) DO NOTHING
         RETURNING id`,
        [feed.id, feed.user_id, entry.key, entry.url, entry.title, entry.publishedAt],
      );

      if (inserted.rowCount === 0) {
        duplicate++;
        continue;
      }

      const item = await ingestItem({
        userId: feed.user_id,
        type: entry.url ? "url" : "text",
        raw_url: entry.url,
        raw_text: entry.url ?? entry.summary ?? entry.title ?? "",
        title: entry.title,
        capture_note: entry.summary,
        source: "rss",
        automationEvent: "rss",
        collection_id: feed.collection_id,
      });

      if (item.success) {
        imported++;
        await db.query(
          `UPDATE rss_feed_entries
           SET item_id = $1
           WHERE feed_id = $2 AND entry_key = $3`,
          [item.id, feed.id, entry.key],
        );
      }
    }

    await db.query(
      `UPDATE rss_feeds
       SET last_fetched_at = NOW(),
           last_success_at = NOW(),
           last_error = NULL,
           next_fetch_at = NOW() + (poll_interval_minutes * INTERVAL '1 minute'),
           updated_at = NOW()
       WHERE id = $1`,
      [feed.id],
    );

    return { imported, duplicate, total: parsed.entries.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.query(
      `UPDATE rss_feeds
       SET last_fetched_at = NOW(),
           last_error = $2,
           next_fetch_at = NOW() + (poll_interval_minutes * INTERVAL '1 minute'),
           updated_at = NOW()
       WHERE id = $1`,
      [feed.id, message.slice(0, 1000)],
    );
    throw error;
  }
}
