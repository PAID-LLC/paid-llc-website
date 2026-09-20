export const runtime = "edge";

// ── GET /comments/rss.xml ────────────────────────────────────────────────────
// The daily feed. Structurally a clone of app/blog/rss.xml/route.ts, same cache
// headers and the same reason for existing: a feed is the cheapest distribution
// a daily publication has, and it is what a MailerLite RSS-to-email campaign
// reads when the digest send goes live.
//
// Each item carries BOTH renderings from lib/comments/feed-html.ts:
//   <description>      plain text, for readers that take the first thing they find
//   <content:encoded>  the full edition as email-safe HTML
// A campaign mails whatever the item holds, so the HTML is the difference
// between a subscriber getting the edition and getting a link to it. See that
// module's header for the compliance lines that have to travel with the item.

import { listEditions, getEditionBundle } from "@/lib/comments/store";
import { editionHtml, editionText } from "@/lib/comments/feed-html";
import { escapeXml, formatEditionDate } from "@/lib/comments/render-helpers";

const SITE = "https://paiddev.com";

/**
 * Wraps HTML in CDATA. The split on "]]>" is the only way to carry that
 * sequence inside a CDATA section, and a comment containing it would otherwise
 * end the section early and break the whole feed.
 */
function cdata(html: string): string {
  return `<![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET() {
  const editions = await listEditions(20);

  const items = await Promise.all(
    editions.slice(0, 20).map(async (e) => {
      const bundle = await getEditionBundle(e.edition_date);
      const url = `${SITE}/comments/${e.edition_date}`;

      // Matches the workflow's first cron so a reader orders editions by when
      // they went out rather than by when this route happened to be called.
      // A fixed stamp is deliberate: GitHub's scheduler has never once fired on
      // time here, and a feed whose item times jump around by two hours reorders
      // itself in a reader for no reason the reader can see.
      const pubDate = e.edition_date
        ? new Date(`${e.edition_date}T09:47:00Z`).toUTCString()
        : new Date().toUTCString();

      const description = bundle ? editionText(bundle) : (e.headline ?? "The Comment Section");
      const content = bundle ? `\n      <content:encoded>${cdata(editionHtml(bundle))}</content:encoded>` : "";

      return `    <item>
      <title>${escapeXml(`${formatEditionDate(e.edition_date)}: ${e.headline ?? "The Comment Section"}`)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>${content}
    </item>`;
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>The Comment Section | PAID LLC</title>
    <link>${SITE}/comments</link>
    <description>Every morning: the fastest-rising videos on YouTube in the US, read through their comment sections. Sentiment, bot estimates, and the funniest comment nobody liked.</description>
    <language>en-us</language>
    <atom:link href="${SITE}/comments/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <copyright>Analysis (c) PAID LLC. Comment text and video details are from YouTube and belong to their authors. Not affiliated with or endorsed by YouTube.</copyright>
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
