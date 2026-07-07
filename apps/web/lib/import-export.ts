import * as cheerio from "cheerio";

export type ParsedBrowserBookmark = {
  sourceId: string;
  url: string;
  title: string;
  folders: string[];
  collectionName: string | null;
  tags: string[];
  addDate: string | null;
  lastModified: string | null;
};

export type ImportSource = "browser_html" | "pocket" | "omnivore" | "linkwarden" | "csv";

export type ParsedImportRecord = {
  sourceId: string;
  url: string;
  title: string;
  collectionName: string | null;
  tags: string[];
  note?: string | null;
  createdAt?: string | null;
};

export type BookmarkExportItem = {
  url: string;
  title: string | null;
  tags: string[] | null;
  collectionName: string | null;
  createdAt: string | Date | null;
};

type BookmarkTreeNode = {
  folders: Map<string, BookmarkTreeNode>;
  items: BookmarkExportItem[];
};

export function parseNetscapeBookmarksHtml(html: string): ParsedBrowserBookmark[] {
  const $ = cheerio.load(html);
  const root = $("body > dl").first().length > 0 ? $("body > dl").first() : $("dl").first();
  if (root.length === 0) return [];

  const bookmarks: ParsedBrowserBookmark[] = [];

  function parseDl(dl: cheerio.Cheerio<any>, folders: string[]) {
    const children = dl.children().toArray();

    for (let index = 0; index < children.length; index++) {
      const child = children[index];
      const tagName = child.tagName?.toLowerCase();
      if (tagName !== "dt") continue;

      const dt = $(child);
      const anchor = dt.children("a").first();
      if (anchor.length > 0) {
        const rawHref = anchor.attr("href")?.trim();
        if (!rawHref) continue;

        let url: string;
        try {
          url = new URL(rawHref).href;
        } catch {
          continue;
        }

        const title = normalizeWhitespace(anchor.text()) || url;
        bookmarks.push({
          sourceId: anchor.attr("id") || anchor.attr("guid") || url,
          url,
          title,
          folders,
          collectionName: folders.length > 0 ? folders.join(" / ") : null,
          tags: parseTags(anchor.attr("tags")),
          addDate: anchor.attr("add_date") || null,
          lastModified: anchor.attr("last_modified") || null,
        });
        continue;
      }

      const heading = dt.children("h3").first();
      if (heading.length === 0) continue;

      const folderName = normalizeWhitespace(heading.text());
      if (!folderName) continue;

      const nestedInDt = dt.children("dl").first();
      if (nestedInDt.length > 0) {
        parseDl(nestedInDt, [...folders, folderName]);
        continue;
      }

      const next = children[index + 1];
      if (next?.tagName?.toLowerCase() === "dl") {
        parseDl($(next), [...folders, folderName]);
        index++;
      }
    }
  }

  parseDl(root, []);
  return bookmarks;
}

export function browserBookmarksToImportRecords(bookmarks: ParsedBrowserBookmark[]): ParsedImportRecord[] {
  return bookmarks.map((bookmark) => ({
    sourceId: bookmark.sourceId,
    url: bookmark.url,
    title: bookmark.title,
    collectionName: bookmark.collectionName,
    tags: bookmark.tags,
    createdAt: unixSecondsToIso(bookmark.addDate),
  }));
}

export function parsePocketExport(input: string): ParsedImportRecord[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parsePocketJson(trimmed);
  }

  return recordsFromCsv(input, {
    url: ["url", "href", "resolved_url", "given_url"],
    title: ["title", "given_title", "resolved_title"],
    tags: ["tags", "tag"],
    folder: ["folder", "collection", "status"],
    createdAt: ["time_added", "created_at", "created"],
  });
}

export function parseOmnivoreExport(input: string): ParsedImportRecord[] {
  const value = JSON.parse(input) as unknown;
  const items = Array.isArray(value)
    ? value
    : Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : Array.isArray((value as { articles?: unknown }).articles)
        ? (value as { articles: unknown[] }).articles
        : [];

  return items.flatMap((item, index) => {
    const record = objectRecord(item);
    if (!record) return [];
    const url = firstString(record, ["url", "originalUrl", "siteUrl", "slug"]);
    const normalizedUrl = normalizeRecordUrl(url);
    if (!normalizedUrl) return [];

    return [{
      sourceId: firstString(record, ["id", "slug", "url"]) ?? String(index + 1),
      url: normalizedUrl,
      title: firstString(record, ["title", "name"]) ?? normalizedUrl,
      collectionName: firstString(record, ["folder", "collection", "state"]),
      tags: normalizeTags(extractTags(record.labels ?? record.tags)),
      note: firstString(record, ["description", "note", "summary"]),
      createdAt: normalizeDate(firstString(record, ["savedAt", "createdAt", "publishedAt"])),
    }];
  });
}

export function parseLinkwardenExport(input: string): ParsedImportRecord[] {
  const value = JSON.parse(input) as unknown;
  const items = Array.isArray(value)
    ? value
    : Array.isArray((value as { links?: unknown }).links)
      ? (value as { links: unknown[] }).links
      : Array.isArray((value as { bookmarks?: unknown }).bookmarks)
        ? (value as { bookmarks: unknown[] }).bookmarks
        : [];

  return items.flatMap((item, index) => {
    const record = objectRecord(item);
    if (!record) return [];
    const url = normalizeRecordUrl(firstString(record, ["url", "link", "href"]));
    if (!url) return [];

    const collection = objectRecord(record.collection);
    return [{
      sourceId: firstString(record, ["id", "url"]) ?? String(index + 1),
      url,
      title: firstString(record, ["name", "title"]) ?? url,
      collectionName: firstString(record, ["collectionName", "folder"]) ?? firstString(collection, ["name"]),
      tags: normalizeTags(extractTags(record.tags)),
      note: firstString(record, ["description", "note", "textContent"]),
      createdAt: normalizeDate(firstString(record, ["createdAt", "created_at", "date"])),
    }];
  });
}

export function parseCsvImport(input: string): ParsedImportRecord[] {
  return recordsFromCsv(input, {
    url: ["url", "href", "link"],
    title: ["title", "name"],
    tags: ["tags", "tag", "labels"],
    folder: ["folder", "collection", "collection_name"],
    note: ["note", "description", "summary"],
    createdAt: ["created_at", "created", "date", "time_added"],
  });
}

export function buildNetscapeBookmarksHtml(items: BookmarkExportItem[]) {
  const root: BookmarkTreeNode = { folders: new Map(), items: [] };

  for (const item of items) {
    const url = item.url?.trim();
    if (!url) continue;

    const path = splitCollectionPath(item.collectionName);
    let node = root;
    for (const folder of path) {
      let next = node.folders.get(folder);
      if (!next) {
        next = { folders: new Map(), items: [] };
        node.folders.set(folder, next);
      }
      node = next;
    }
    node.items.push(item);
  }

  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>RecallQ Bookmarks</TITLE>",
    "<H1>RecallQ Bookmarks</H1>",
    "<DL><p>",
  ];

  emitTree(lines, root, 1);
  lines.push("</DL><p>");
  return `${lines.join("\n")}\n`;
}

export function buildJsonExportPayload(input: {
  items: Array<{ tags?: string[] | null; [key: string]: unknown }>;
  collections: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  archiveAssets: Array<Record<string, unknown>>;
  highlights?: Array<Record<string, unknown>>;
  exportedAt?: string;
}) {
  const tags = Array.from(
    new Set(
      input.items.flatMap((item) => Array.isArray(item.tags) ? item.tags : []),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return {
    schema: "recallq.export.v1",
    exported_at: input.exportedAt ?? new Date().toISOString(),
    tags,
    collections: input.collections,
    items: input.items,
    reminders: input.reminders,
    highlights: input.highlights ?? [],
    archive_assets: input.archiveAssets,
  };
}

function emitTree(lines: string[], node: BookmarkTreeNode, depth: number) {
  const indent = "  ".repeat(depth);
  const folders = Array.from(node.folders.entries()).sort(([a], [b]) => a.localeCompare(b));

  for (const item of node.items) {
    const addDate = toUnixSeconds(item.createdAt);
    const tags = normalizeTags(item.tags ?? []);
    const tagAttr = tags.length > 0 ? ` TAGS="${escapeHtmlAttr(tags.join(","))}"` : "";
    lines.push(
      `${indent}<DT><A HREF="${escapeHtmlAttr(item.url)}" ADD_DATE="${addDate}"${tagAttr}>${escapeHtmlText(
        item.title?.trim() || item.url,
      )}</A>`,
    );
  }

  for (const [folder, child] of folders) {
    lines.push(`${indent}<DT><H3>${escapeHtmlText(folder)}</H3>`);
    lines.push(`${indent}<DL><p>`);
    emitTree(lines, child, depth + 1);
    lines.push(`${indent}</DL><p>`);
  }
}

function parseTags(value: string | undefined) {
  if (!value) return [];
  return normalizeTags(value.split(","));
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeWhitespace(tag).slice(0, 50);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result.slice(0, 10);
}

function parseLooseTags(value: unknown) {
  if (Array.isArray(value)) return normalizeTags(value.map((entry) => String(entry)));
  if (typeof value !== "string") return [];
  return normalizeTags(value.split(/[;,|]/));
}

function splitCollectionPath(collectionName: string | null) {
  if (!collectionName) return [];
  return collectionName
    .split("/")
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toUnixSeconds(value: string | Date | null) {
  if (!value) return Math.floor(Date.now() / 1000);
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(time)) return Math.floor(Date.now() / 1000);
  return Math.floor(time / 1000);
}

function unixSecondsToIso(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const numeric = Number(value);
  const time = Number.isFinite(numeric)
    ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000).getTime()
    : Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString();
}

function normalizeRecordUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
}

function recordsFromCsv(
  input: string,
  columns: {
    url: string[];
    title: string[];
    tags?: string[];
    folder?: string[];
    note?: string[];
    createdAt?: string[];
  },
) {
  const rows = parseCsvRows(input);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase());

  return rows.slice(1).flatMap((row, index) => {
    const get = (names: string[] | undefined) => {
      if (!names) return null;
      for (const name of names) {
        const columnIndex = headers.indexOf(name.toLowerCase());
        if (columnIndex >= 0) {
          const value = row[columnIndex]?.trim();
          if (value) return value;
        }
      }
      return null;
    };

    const url = normalizeRecordUrl(get(columns.url));
    if (!url) return [];
    return [{
      sourceId: get(["id", "uuid", "source_id"]) ?? url,
      url,
      title: get(columns.title) ?? url,
      collectionName: get(columns.folder ?? []),
      tags: parseLooseTags(get(columns.tags ?? [])),
      note: get(columns.note ?? []),
      createdAt: normalizeDate(get(columns.createdAt ?? [])),
    }];
  });
}

function parseCsvRows(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index++;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parsePocketJson(input: string) {
  const value = JSON.parse(input) as unknown;
  const list = objectRecord(value)?.list;
  const items = Array.isArray(value)
    ? value
    : Array.isArray(list)
      ? list
      : list && typeof list === "object"
        ? Object.values(list)
        : [];

  return items.flatMap((item, index) => {
    const record = objectRecord(item);
    if (!record) return [];
    const url = normalizeRecordUrl(firstString(record, ["resolved_url", "given_url", "url"]));
    if (!url) return [];
    return [{
      sourceId: firstString(record, ["item_id", "id", "url"]) ?? String(index + 1),
      url,
      title: firstString(record, ["resolved_title", "given_title", "title"]) ?? url,
      collectionName: firstString(record, ["status"]) === "1" ? "Pocket Archive" : null,
      tags: normalizeTags(extractTags(record.tags)),
      createdAt: normalizeDate(firstString(record, ["time_added", "created_at"])),
    }];
  });
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstString(record: Record<string, unknown> | null, names: string[]) {
  if (!record) return null;
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function extractTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      const record = objectRecord(entry);
      return firstString(record, ["name", "label", "title"]) ?? [];
    });
  }
  const record = objectRecord(value);
  if (record) return Object.keys(record);
  return parseLooseTags(value);
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value: string) {
  return escapeHtmlText(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
