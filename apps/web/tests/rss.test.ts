import assert from "node:assert/strict";
import { parseFeedXml } from "../lib/rss-parser.ts";

export function runRssTests() {
  {
    const parsed = parseFeedXml(
      `<?xml version="1.0"?>
       <rss version="2.0">
         <channel>
           <title>Example Feed</title>
           <item>
             <title>First post</title>
             <link>/first</link>
             <guid>guid-1</guid>
             <description>Summary</description>
             <pubDate>Mon, 06 Jul 2026 10:00:00 GMT</pubDate>
           </item>
         </channel>
       </rss>`,
      "https://example.com/feed.xml",
    );

    assert.equal(parsed.title, "Example Feed");
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0].key, "guid-1");
    assert.equal(parsed.entries[0].url, "https://example.com/first");
    assert.equal(parsed.entries[0].publishedAt, "2026-07-06T10:00:00.000Z");
  }

  {
    const parsed = parseFeedXml(
      `<feed>
         <title>Atom Feed</title>
         <entry>
           <id>tag:example.com,2026:1</id>
           <title>Atom post</title>
           <link href="https://example.com/atom" />
           <summary>Atom summary</summary>
           <updated>2026-07-07T01:02:03Z</updated>
         </entry>
       </feed>`,
    );

    assert.equal(parsed.title, "Atom Feed");
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0].key, "tag:example.com,2026:1");
    assert.equal(parsed.entries[0].url, "https://example.com/atom");
    assert.equal(parsed.entries[0].summary, "Atom summary");
  }
}
