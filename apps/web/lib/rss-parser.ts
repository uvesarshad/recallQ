import * as cheerio from "cheerio";

export type ParsedFeedEntry = {
  key: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  publishedAt: string | null;
};

export type ParsedFeed = {
  title: string | null;
  entries: ParsedFeedEntry[];
};

function text($node: cheerio.Cheerio<any>, selector: string) {
  const direct = $node.children(selector).first().text().trim();
  return direct || null;
}

function attrOrText($node: cheerio.Cheerio<any>, selector: string, attr: string) {
  const child = $node.children(selector).first();
  return child.attr(attr)?.trim() || child.text().trim() || null;
}

function normalizePublishedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveFeedUrl(value: string | null, baseUrl: string) {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function parseFeedXml(xml: string, feedUrl = "https://example.com/feed.xml"): ParsedFeed {
  const $ = cheerio.load(xml, { xmlMode: true });
  const channelTitle = $("channel > title").first().text().trim() || $("feed > title").first().text().trim() || null;
  const entries: ParsedFeedEntry[] = [];

  $("item").each((_, element) => {
    const $item = $(element);
    const url = resolveFeedUrl(text($item, "link"), feedUrl);
    const guid = text($item, "guid");
    const title = text($item, "title");
    const summary = text($item, "description") ?? text($item, "content\\:encoded");
    const publishedAt = normalizePublishedAt(text($item, "pubDate") ?? text($item, "dc\\:date"));
    const key = guid || url || `${title ?? "untitled"}:${publishedAt ?? ""}`;

    entries.push({ key, title, url, summary, publishedAt });
  });

  $("feed > entry").each((_, element) => {
    const $entry = $(element);
    const url = resolveFeedUrl(attrOrText($entry, "link", "href"), feedUrl);
    const title = text($entry, "title");
    const summary = text($entry, "summary") ?? text($entry, "content");
    const publishedAt = normalizePublishedAt(text($entry, "published") ?? text($entry, "updated"));
    const key = text($entry, "id") || url || `${title ?? "untitled"}:${publishedAt ?? ""}`;

    entries.push({ key, title, url, summary, publishedAt });
  });

  return {
    title: channelTitle,
    entries: entries.filter((entry) => entry.key && (entry.url || entry.title || entry.summary)).slice(0, 100),
  };
}
