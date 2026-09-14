export const runtime = "edge";

// ── GET /comments/sitemap.xml ────────────────────────────────────────────────
// Every edition and every video permalink, for crawlers.
//
// This is a route rather than an entry in app/sitemap.ts because that file is
// synchronous and hand-listed (and has no runtime export, so making it async and
// database-backed would change how it builds). A daily publication adds six URLs
// a day; keeping them here means the main sitemap stays a static list of the
// site's fixed pages, and public/robots.txt simply names a second Sitemap.

import { listEditions, getVideosForEdition } from "@/lib/comments/store";
import { escapeXml } from "@/lib/comments/render-helpers";

const SITE = "https://paiddev.com";

export async function GET() {
  const editions = await listEditions(400);

  const urls: { loc: string; lastmod?: string; priority: string; changefreq: string }[] = [
    { loc: `${SITE}/comments`, priority: "0.9", changefreq: "daily" },
    { loc: `${SITE}/comments/archive`, priority: "0.5", changefreq: "daily" },
    { loc: `${SITE}/comments/about`, priority: "0.4", changefreq: "yearly" },
  ];

  for (const e of editions) {
    urls.push({
      loc: `${SITE}/comments/${e.edition_date}`,
      lastmod: e.edition_date,
      priority: "0.7",
      changefreq: "never",
    });
  }

  // Video permalinks, for the most recent editions only. Older ones stay
  // reachable through their edition page; listing every one of them forever
  // would mean a request per edition on every crawl of this file.
  for (const e of editions.slice(0, 30)) {
    const videos = await getVideosForEdition(e.edition_date);
    for (const v of videos) {
      if (v.status !== "analyzed") continue;
      urls.push({
        loc: `${SITE}/comments/v/${v.video_id}`,
        lastmod: e.edition_date,
        priority: "0.6",
        changefreq: "never",
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
