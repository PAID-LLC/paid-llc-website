/**
 * Renders a published edition through the feed's HTML builder and writes it to
 * a local file, so the email can be looked at before it is sent.
 *
 *   npx tsx --env-file=.env.local scripts/comments-email-preview.ts           # latest
 *   npx tsx --env-file=.env.local scripts/comments-email-preview.ts 2026-09-19
 *
 * Why this exists: /comments/rss.xml is what a MailerLite campaign mails, and a
 * sent email cannot be corrected or taken down. Reading the XML in a terminal
 * tells you the markup is present; it does not tell you the thing is readable.
 * This is read-only against Supabase and writes one file to .preview/.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { editionHtml, editionText } from "../lib/comments/feed-html";
import type { EditionBundle, EditionRow, VideoRow, FeaturedRow } from "../lib/comments/types";

const DATE = process.argv[2] ?? null;
const OUT = ".preview/comments-email.html";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required. Run with --env-file=.env.local");
    process.exit(1);
  }

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  async function get<T>(path: string): Promise<T[]> {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
    return res.json() as Promise<T[]>;
  }

  const where = DATE
    ? `edition_date=eq.${encodeURIComponent(DATE)}`
    : "status=eq.published&order=edition_date.desc&limit=1";
  const [edition] = await get<EditionRow>(`comment_editions?${where}&select=*`);
  if (!edition) {
    console.error(DATE ? `No edition for ${DATE}.` : "No published edition yet.");
    process.exit(1);
  }

  const videos = await get<VideoRow>(
    `comment_videos?first_edition=eq.${encodeURIComponent(edition.edition_date)}&order=rank.asc`
  );
  const ids = videos.map((v) => `"${v.video_id}"`).join(",");
  const featured = ids
    ? await get<FeaturedRow>(`comment_featured?video_id=in.(${encodeURIComponent(ids)})&select=*`)
    : [];

  const bundle: EditionBundle = { edition, videos, featured };
  const html = editionHtml(bundle);
  const text = editionText(bundle);

  // A 600px card on a grey field: the width every email client renders into.
  mkdirSync(".preview", { recursive: true });
  writeFileSync(
    OUT,
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Edition ${edition.edition_no ?? ""} email preview</title></head>` +
      `<body style="margin:0;background:#e7e5e4;padding:24px;">` +
      `<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:28px;border-radius:10px;">${html}</div>` +
      `</body></html>`
  );

  console.log(`edition ${edition.edition_no ?? "?"} (${edition.edition_date})`);
  console.log(`  ${videos.filter((v) => v.status === "analyzed").length} videos, ${featured.length} featured comments`);
  console.log(`  html ${html.length} bytes, plain text ${text.length} bytes`);
  console.log(`  em dashes: ${/[—–]/.test(html + text) ? "FOUND, fix before sending" : "none"}`);
  console.log(`  wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
