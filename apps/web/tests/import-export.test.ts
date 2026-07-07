import assert from "node:assert/strict";
import {
  buildJsonExportPayload,
  buildNetscapeBookmarksHtml,
  parseCsvImport,
  parseLinkwardenExport,
  parseNetscapeBookmarksHtml,
  parseOmnivoreExport,
  parsePocketExport,
} from "../lib/import-export.ts";

export function runImportExportTests() {
  const bookmarks = parseNetscapeBookmarksHtml(`
    <!DOCTYPE NETSCAPE-Bookmark-file-1>
    <DL><p>
      <DT><H3>Bookmarks Bar</H3>
      <DL><p>
        <DT><H3>Engineering</H3>
        <DL><p>
          <DT><A HREF="https://example.com/path" ADD_DATE="1710000000" TAGS="docs, reference,docs">Example Docs</A>
        </DL><p>
        <DT><A HREF="not a url">Broken</A>
      </DL><p>
      <DT><A HREF="https://news.example/" TAGS="read later">News</A>
    </DL><p>
  `);

  assert.equal(bookmarks.length, 2);
  assert.deepEqual(bookmarks[0], {
    sourceId: "https://example.com/path",
    url: "https://example.com/path",
    title: "Example Docs",
    folders: ["Bookmarks Bar", "Engineering"],
    collectionName: "Bookmarks Bar / Engineering",
    tags: ["docs", "reference"],
    addDate: "1710000000",
    lastModified: null,
  });
  assert.equal(bookmarks[1].collectionName, null);
  assert.deepEqual(bookmarks[1].tags, ["read later"]);

  const html = buildNetscapeBookmarksHtml([
    {
      url: "https://example.com/path?x=1&y=2",
      title: "Example <Docs>",
      tags: ["docs", "reference"],
      collectionName: "Bookmarks Bar / Engineering",
      createdAt: "2024-03-09T16:00:00.000Z",
    },
  ]);
  assert.match(html, /<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.match(html, /<DT><H3>Bookmarks Bar<\/H3>/);
  assert.match(html, /<DT><H3>Engineering<\/H3>/);
  assert.match(html, /TAGS="docs,reference"/);
  assert.match(html, /HREF="https:\/\/example\.com\/path\?x=1&amp;y=2"/);
  assert.match(html, />Example &lt;Docs&gt;<\/A>/);

  const json = buildJsonExportPayload({
    exportedAt: "2026-07-07T00:00:00.000Z",
    items: [{ id: "1", tags: ["beta", "alpha"] }, { id: "2", tags: ["alpha"] }],
    collections: [{ id: "c1" }],
    reminders: [{ id: "r1" }],
    archiveAssets: [{ id: "a1", file_path: "/data/file.html" }],
  });
  assert.equal(json.schema, "recallq.export.v1");
  assert.deepEqual(json.tags, ["alpha", "beta"]);
  assert.deepEqual(json.highlights, []);
  assert.deepEqual(json.archive_assets, [{ id: "a1", file_path: "/data/file.html" }]);

  const pocket = parsePocketExport(`title,url,time_added,tags,status
"Saved, Article",https://pocket.example/read,1710000000,"ai;research",0`);
  assert.equal(pocket.length, 1);
  assert.equal(pocket[0].url, "https://pocket.example/read");
  assert.equal(pocket[0].title, "Saved, Article");
  assert.deepEqual(pocket[0].tags, ["ai", "research"]);

  const omnivore = parseOmnivoreExport(JSON.stringify({
    items: [{
      id: "omni-1",
      url: "https://omnivore.example/post",
      title: "Omnivore Post",
      labels: [{ name: "reading" }, { name: "product" }],
      state: "ARCHIVED",
    }],
  }));
  assert.equal(omnivore[0].sourceId, "omni-1");
  assert.equal(omnivore[0].collectionName, "ARCHIVED");
  assert.deepEqual(omnivore[0].tags, ["reading", "product"]);

  const linkwarden = parseLinkwardenExport(JSON.stringify({
    links: [{
      id: "lw-1",
      url: "https://linkwarden.example/link",
      name: "Linkwarden Link",
      collection: { name: "Research" },
      tags: [{ name: "saved" }],
    }],
  }));
  assert.equal(linkwarden[0].title, "Linkwarden Link");
  assert.equal(linkwarden[0].collectionName, "Research");
  assert.deepEqual(linkwarden[0].tags, ["saved"]);

  const csv = parseCsvImport(`url,title,folder,tags,note
https://csv.example/,CSV Link,Inbox,"one|two","keep this"`);
  assert.equal(csv[0].collectionName, "Inbox");
  assert.deepEqual(csv[0].tags, ["one", "two"]);
  assert.equal(csv[0].note, "keep this");
}
