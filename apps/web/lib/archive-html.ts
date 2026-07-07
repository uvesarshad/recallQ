import * as cheerio from "cheerio";

export const ARCHIVE_TEXT_MAX_BYTES = 512 * 1024;

function resolveUrl(candidate: string | undefined, baseUrl: string) {
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

export function isBrokenLinkStatus(status: number) {
  return status >= 400;
}

export function sanitizeHtmlSnapshot(html: string, baseUrl: string) {
  const $ = cheerio.load(html);

  $("script, iframe, object, embed, form, input, textarea, select, option").remove();
  $("meta[http-equiv]").each((_, element) => {
    const value = String($(element).attr("http-equiv") ?? "").toLowerCase();
    if (value === "refresh") {
      $(element).remove();
    }
  });

  $("*").each((_, element) => {
    const attributes = $(element).attr() ?? {};
    for (const [name, value] of Object.entries(attributes)) {
      const normalizedName = name.toLowerCase();
      const normalizedValue = String(value).trim().toLowerCase();
      if (
        normalizedName.startsWith("on") ||
        normalizedName === "srcdoc" ||
        normalizedValue.startsWith("javascript:")
      ) {
        $(element).removeAttr(name);
      }
    }
  });

  const canonicalUrl = resolveUrl($('link[rel="canonical"]').attr("href"), baseUrl);
  const title = $("title").first().text().replace(/\s+/g, " ").trim() || null;
  $("br,p,div,section,article,li,h1,h2,h3,h4,h5,h6").append(" ");
  const extractedText = $("body").text().replace(/\s+/g, " ").trim().slice(0, ARCHIVE_TEXT_MAX_BYTES);

  return {
    sanitizedHtml: $.html(),
    extractedText,
    canonicalUrl,
    title,
  };
}

export function archiveMetadataFromResponse(args: {
  response: Response;
  sourceUrl: string;
  finalUrl: string;
  canonicalUrl: string | null;
  title: string | null;
  contentHash: string;
}) {
  return {
    source_url: args.sourceUrl,
    final_url: args.finalUrl,
    canonical_url: args.canonicalUrl,
    title: args.title,
    content_hash: args.contentHash,
    http_status: args.response.status,
    content_type: args.response.headers.get("content-type"),
    content_length: args.response.headers.get("content-length"),
    etag: args.response.headers.get("etag"),
    last_modified: args.response.headers.get("last-modified"),
  };
}
