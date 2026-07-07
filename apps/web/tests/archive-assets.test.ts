import assert from "node:assert/strict";
import {
  archiveMetadataFromResponse,
  isBrokenLinkStatus,
  sanitizeHtmlSnapshot,
} from "../lib/archive-html.ts";
import {
  ARCHIVE_FAILED_RETENTION_DAYS,
  isArchiveAssetRetentionDue,
  normalizeArchiveAssetKinds,
  retentionExpiresAt,
} from "../lib/archive-assets.ts";

export function runArchiveAssetsTests() {
  const snapshot = sanitizeHtmlSnapshot(
    `<!doctype html>
     <html>
       <head>
         <title> Example Article </title>
         <link rel="canonical" href="/canonical">
         <meta http-equiv="refresh" content="0; url=http://evil.test">
       </head>
       <body onload="steal()">
         <script>alert("x")</script>
         <a href="javascript:alert(1)" onclick="steal()">bad link</a>
         <article><h1>Hello</h1><p>Readable text</p></article>
       </body>
     </html>`,
    "https://example.com/source",
  );

  assert.equal(snapshot.canonicalUrl, "https://example.com/canonical");
  assert.equal(snapshot.title, "Example Article");
  assert.match(snapshot.extractedText, /Hello Readable text/);
  assert.doesNotMatch(snapshot.sanitizedHtml, /<script/i);
  assert.doesNotMatch(snapshot.sanitizedHtml, /onload=/i);
  assert.doesNotMatch(snapshot.sanitizedHtml, /onclick=/i);
  assert.doesNotMatch(snapshot.sanitizedHtml, /javascript:/i);
  assert.doesNotMatch(snapshot.sanitizedHtml, /http-equiv="refresh"/i);

  assert.equal(isBrokenLinkStatus(200), false);
  assert.equal(isBrokenLinkStatus(399), false);
  assert.equal(isBrokenLinkStatus(404), true);
  assert.equal(isBrokenLinkStatus(500), true);

  const response = new Response("<html></html>", {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      etag: '"abc"',
      "last-modified": "Tue, 07 Jul 2026 00:00:00 GMT",
    },
  });
  const metadata = archiveMetadataFromResponse({
    response,
    sourceUrl: "https://example.com/source",
    finalUrl: "https://example.com/final",
    canonicalUrl: "https://example.com/canonical",
    title: "Example Article",
    contentHash: "hash",
  });

  assert.equal(metadata.http_status, 200);
  assert.equal(metadata.content_type, "text/html; charset=utf-8");
  assert.equal(metadata.etag, '"abc"');
  assert.equal(metadata.canonical_url, "https://example.com/canonical");

  assert.deepEqual(normalizeArchiveAssetKinds(["pdf", "html", "pdf", "unknown"]), ["pdf", "html"]);
  assert.deepEqual(normalizeArchiveAssetKinds([]), ["html"]);
  assert.match(retentionExpiresAt(1, new Date("2026-07-07T00:00:00.000Z")), /^2026-07-08T00:00:00/);

  assert.equal(
    isArchiveAssetRetentionDue({
      status: "available",
      createdAt: "2026-07-01T00:00:00.000Z",
      retentionExpiresAt: "2026-07-06T00:00:00.000Z",
      now: new Date("2026-07-07T00:00:00.000Z"),
    }),
    true,
  );
  assert.equal(
    isArchiveAssetRetentionDue({
      status: "failed",
      createdAt: new Date(Date.UTC(2026, 6, 7 - ARCHIVE_FAILED_RETENTION_DAYS - 1)),
      now: new Date("2026-07-07T00:00:00.000Z"),
    }),
    true,
  );
  assert.equal(
    isArchiveAssetRetentionDue({
      status: "available",
      createdAt: "2026-07-07T00:00:00.000Z",
      now: new Date("2026-07-07T00:00:00.000Z"),
    }),
    false,
  );
}
