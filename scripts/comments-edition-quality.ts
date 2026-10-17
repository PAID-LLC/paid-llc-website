/**
 * Score Comment Section editions the picker already published.
 *
 *   npx tsx scripts/comments-edition-quality.ts
 *   npx tsx scripts/comments-edition-quality.ts tests/fixtures/comment-editions-2026-10.json
 *   npx tsx scripts/comments-edition-quality.ts --live
 *
 * The default input is the 2026-10-03 to 2026-10-16 fixture checked into the
 * repo: views per hour and comment counts as the public pages rendered them,
 * with no YouTube quota and no Supabase. --live refetches the last 14 edition
 * dates from paiddev.com (the public API plus each edition page) and scores
 * that. It does not change what tomorrow's edition will pick; it measures
 * what already shipped.
 *
 * "Would reject" is the current hard gate replayed on those cards. It is not a
 * reconstruction of the day's pool: a video this report keeps might still lose
 * its slot to a better one, and a repeat channel is counted above rather than
 * rejected here, because cooldown needs the rest of the pool to know what
 * replaces it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formatQualityReport, type QualityEdition, type QualityVideo } from "../lib/comments/quality";

const FIXTURE = fileURLToPath(new URL("../tests/fixtures/comment-editions-2026-10.json", import.meta.url));

async function main() {
  const arg = process.argv[2];
  const editions = arg === "--live" ? await fetchLive() : loadFile(arg);
  console.log(formatQualityReport(editions));
}

function loadFile(path: string | undefined): QualityEdition[] {
  return JSON.parse(readFileSync(path ?? FIXTURE, "utf8")) as QualityEdition[];
}

interface LiveEdition {
  error?: string;
  edition_date: string;
  edition_no?: number | null;
  videos?: LiveVideo[];
  skipped?: { video_id: string; title: string; reason?: string }[];
}

async function fetchLive(): Promise<QualityEdition[]> {
  const today = new Date();
  const editions: QualityEdition[] = [];
  for (let back = 1; back <= 14; back++) {
    const day = new Date(today.getTime() - back * 86_400_000);
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(day);
    const api = await getJson(`https://paiddev.com/api/comments/edition?date=${date}`);
    if (!api || api.error || !api.edition_date) continue;
    const page = await getText(`https://paiddev.com/comments/${date}`);
    const stats = page ? parseEditionHtml(page) : new Map<string, Partial<QualityVideo>>();
    const videos: QualityVideo[] = (api.videos ?? []).map((v: LiveVideo) => {
      const st = stats.get(v.video_id) ?? {};
      const read = st.commentsRead ?? v.analysis?.comments_analyzed ?? null;
      return {
        videoId: v.video_id,
        title: v.title,
        channel: v.channel,
        views: st.views ?? null,
        viewsPerHour: st.viewsPerHour ?? null,
        commentsRead: read,
        commentsCapped: st.commentsCapped ?? read === 1000,
        durationS: st.durationS ?? null,
        available: true,
      };
    });
    editions.push({
      editionDate: api.edition_date,
      editionNo: api.edition_no ?? null,
      videos,
      skipped: (api.skipped ?? []).map((s) => ({
        videoId: s.video_id,
        title: s.title,
        reason: s.reason ?? null,
      })),
    });
  }
  return editions.reverse();
}

interface LiveVideo {
  video_id: string;
  title: string;
  channel: string;
  analysis?: { comments_analyzed?: number };
}

async function getJson(url: string): Promise<LiveEdition | null> {
  const res = await fetch(url, { headers: { "User-Agent": "paid-comments-quality" } });
  if (!res.ok) return null;
  return (await res.json()) as LiveEdition;
}

async function getText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": "paid-comments-quality" } });
  if (!res.ok) return null;
  return res.text();
}

function parseCount(raw: string): number {
  const s = raw.trim();
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("k")) return Math.round(parseFloat(s) * 1_000);
  return Math.round(parseFloat(s));
}

function parseDuration(raw: string): number {
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

/** Pulls the per-video stats line out of a rendered edition page. */
function parseEditionHtml(html: string): Map<string, Partial<QualityVideo>> {
  const out = new Map<string, Partial<QualityVideo>>();
  const parts = html.split(/https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const chunk = parts[i + 1]?.slice(0, 5000) ?? "";
    if (chunk.startsWith("&amp;lc") || chunk.startsWith("&lc") || out.has(id)) continue;
    const views = chunk.match(/<span>([\d.]+[kM]?)<!-- --> views<\/span>/);
    const vph = chunk.match(/>([\d.]+[kM]?)<!-- -->\/hr<\/span>/);
    const read = chunk.match(/<span>([\d,]+)<!-- --> comments read<\/span>/);
    const readK = chunk.match(/<span>([\d.]+k)<!-- --> comments read<\/span>/);
    const dur = chunk.match(/<span>(\d+:\d{2}(?::\d{2})?)<\/span>/);
    if (!views && !vph) continue;
    out.set(id, {
      views: views ? parseCount(views[1]) : null,
      viewsPerHour: vph ? parseCount(vph[1]) : null,
      commentsRead: read ? Number(read[1].replace(/,/g, "")) : readK ? parseCount(readK[1]) : null,
      commentsCapped: !read && !!readK,
      durationS: dur ? parseDuration(dur[1]) : null,
    });
  }
  return out;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
