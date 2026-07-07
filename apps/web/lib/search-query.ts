export type SearchMode = "hybrid" | "fulltext" | "semantic";

type SearchToken = {
  value: string;
  quoted: boolean;
};

export type TextTerm = {
  value: string;
  quoted: boolean;
};

export type ParsedSearchQuery = {
  original: string;
  textQuery: string;
  groups: TextTerm[][];
  filters: {
    types: string[];
    tags: string[];
    folders: string[];
    sources: string[];
    after: string | null;
    before: string | null;
    hasReminder: boolean | null;
    isEnriched: boolean | null;
    isBroken: boolean | null;
  };
};

export type DecodedSearchCursor = {
  v: 1;
  mode: SearchMode;
  query: string;
  offset: number;
};

const VALID_TYPES = new Set(["url", "text", "file", "note"]);
const VALID_SOURCES = new Set(["web", "pwa-share", "telegram", "email", "extension", "mobile", "manual"]);

function tokenizeSearch(input: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  let current = "";
  let inQuote = false;
  let tokenQuoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i] || "";
    if (char === '"') {
      inQuote = !inQuote;
      tokenQuoted = true;
      continue;
    }
    if (/\s/.test(char) && !inQuote) {
      if (current.trim()) {
        tokens.push({ value: current.trim(), quoted: tokenQuoted });
      }
      current = "";
      tokenQuoted = false;
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    tokens.push({ value: current.trim(), quoted: tokenQuoted });
  }

  return tokens;
}

function normalizeDate(value: string, endOfDay: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const date = new Date(dateOnly && endOfDay ? `${trimmed}T23:59:59.999Z` : trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function parseAdvancedSearch(query: string): ParsedSearchQuery {
  const tokens = tokenizeSearch(query);
  const groups: TextTerm[][] = [[]];
  const filters: ParsedSearchQuery["filters"] = {
    types: [],
    tags: [],
    folders: [],
    sources: [],
    after: null,
    before: null,
    hasReminder: null,
    isEnriched: null,
    isBroken: null,
  };

  for (const token of tokens) {
    const lower = token.value.toLowerCase();
    if (!token.quoted && lower === "or") {
      if (groups[groups.length - 1]?.length) groups.push([]);
      continue;
    }
    if (!token.quoted && lower === "and") {
      continue;
    }

    const fieldMatch = token.value.match(/^([a-z]+):(.+)$/i);
    if (fieldMatch) {
      const field = fieldMatch[1]?.toLowerCase() || "";
      const value = (fieldMatch[2] || "").trim();
      const loweredValue = value.toLowerCase();
      if (field === "type" && VALID_TYPES.has(loweredValue)) {
        filters.types.push(loweredValue);
        continue;
      }
      if (field === "tag" && value) {
        filters.tags.push(value);
        continue;
      }
      if (field === "folder" && value) {
        filters.folders.push(value);
        continue;
      }
      if (field === "source" && VALID_SOURCES.has(loweredValue)) {
        filters.sources.push(loweredValue);
        continue;
      }
      if (field === "after") {
        filters.after = normalizeDate(value, false);
        continue;
      }
      if (field === "before") {
        filters.before = normalizeDate(value, true);
        continue;
      }
      if (field === "has" && loweredValue === "reminder") {
        filters.hasReminder = true;
        continue;
      }
      if (field === "is" && loweredValue === "enriched") {
        filters.isEnriched = true;
        continue;
      }
      if (field === "is" && loweredValue === "unenriched") {
        filters.isEnriched = false;
        continue;
      }
      if (field === "is" && loweredValue === "broken") {
        filters.isBroken = true;
        continue;
      }
    }

    groups[groups.length - 1]?.push({ value: token.value, quoted: token.quoted });
  }

  const nonEmptyGroups = groups.filter((group) => group.length > 0);
  const textQuery = nonEmptyGroups
    .map((group) =>
      group
        .map((term) => (term.quoted || /\s/.test(term.value) ? `"${term.value.replaceAll('"', "")}"` : term.value))
        .join(" "),
    )
    .join(" OR ");

  return {
    original: query,
    textQuery,
    groups: nonEmptyGroups,
    filters,
  };
}

export function encodeSearchCursor(cursor: DecodedSearchCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeSearchCursor(
  cursor: string | null | undefined,
  mode: SearchMode,
  query: string,
): DecodedSearchCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<DecodedSearchCursor>;
    if (parsed.v !== 1 || parsed.mode !== mode || parsed.query !== query) return null;
    const offset = Number(parsed.offset);
    if (!Number.isFinite(offset) || offset < 0) return null;
    return { v: 1, mode, query, offset: Math.trunc(offset) };
  } catch {
    return null;
  }
}

export const searchCursorForTests = {
  encodeCursor: encodeSearchCursor,
  decodeCursor: decodeSearchCursor,
};
