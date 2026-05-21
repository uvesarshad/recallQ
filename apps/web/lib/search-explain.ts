type SearchExplainItem = {
  title?: string | null;
  summary?: string | null;
  raw_text?: string | null;
  raw_url?: string | null;
  tags?: string[] | null;
};

export function getMatchReasons(query: string, item: SearchExplainItem) {
  const normalizedTerms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (normalizedTerms.length === 0) {
    return [];
  }

  const reasons: string[] = [];

  if (matchesTerms(item.title, normalizedTerms)) {
    reasons.push("Title hit");
  }

  if (matchesTerms(item.summary, normalizedTerms)) {
    reasons.push("Summary hit");
  }

  if (item.tags?.some((tag) => normalizedTerms.some((term) => tag.toLowerCase().includes(term)))) {
    reasons.push("Tag hit");
  }

  if (matchesTerms(item.raw_url, normalizedTerms)) {
    reasons.push("URL hit");
  }

  if (matchesTerms(item.raw_text, normalizedTerms)) {
    reasons.push("Content hit");
  }

  return reasons;
}

function matchesTerms(value: string | null | undefined, terms: string[]) {
  if (!value) {
    return false;
  }

  const haystack = value.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}
