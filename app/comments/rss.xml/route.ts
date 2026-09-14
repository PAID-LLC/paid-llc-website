export const runtime = "edge";

// ── GET /comments/rss.xml ────────────────────────────────────────────────────
// The daily feed. Structurally a clone of app/blog/rss.xml/route.ts, same cache
// headers and the same reason for existing: a feed is the cheapest distribution
// a daily publication has, and it is what a MailerLite RSS-to-email campaign
// reads when the digest send goes live.
//
// Each item carries the headline, the day's numbers, and the featured comment
// with attribution, so a feed reader gets something worth reading rather than a
// bare link.

import { listEditions, getEditionBundle } from "@/lib/comments/store";
import { escapeXml, formatEditionDate, formatCount, pct } from "@/lib/comments/render-helpers";

const SITE = "https://paiddev.com";

export async function GET() {
  const editions = await listEditions(20);

  const items = await Promise.all(
    editions.slice(0, 20).map(async (e) => {
      const bundle = await getEditionBundle(e.edition_date);
      const url = `${SITE}/comments/${e.edition_date}`;
      const stats = e.stats ?? {};

      const lines: string[] = [];
      if (e.headline) lines.push(escapeXml(e.headline));
      if (stats.commentsAnalyzed) {
        lines.push(
          `${formatCount(stats.commentsAnalyzed)} comments read. ` +
            `${pct(stats.positiveShare ?? 0)} positive, ` +
            `${pct(stats.negativeShare ?? 0)} negative, ` +
            `about ${pct(stats.automationShare ?? 0)} estimated automated.`
        );
      }

      if (bundle) {
        const hero = bundle.featured.find((f) => f.comment_id === bundle.edition.hero_comment_id);
        if (hero?.text) {
          lines.push(
            `Underrated comment of the day (${hero.like_count} likes): ` +
              `"${escapeXml(hero.text)}" — ${escapeXml(hero.author_display ?? "Unknown")}`
          );
        }
        const titles = bundle.videos
          .filter((v) => v.status === "analyzed")
          .map((v) => `- ${escapeXml(v.title)} (${escapeXml(v.channel_title)})`);
        if (titles.length) lines.push("Today's videos:", ...titles);
      }

      const pubDate = e.edition_date
        ? new Date(`${e.edition_date}T12:05:00Z`).toUTCString()
        : new Date().toUTCString();

      return `    <item>
      <title>${escapeXml(`${formatEditionDate(e.edition_date)}: ${e.headline ?? "The Comment Section"}`)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(lines.join("\n\n"))}</description>
    </item>`;
    })
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Comment Section | PAID LLC</title>
    <link>${SITE}/comments</link>
    <description>Every morning: the most-watched videos in the United States, read through their comment sections. Sentiment, bot estimates, and the funniest comment nobody liked.</description>
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
