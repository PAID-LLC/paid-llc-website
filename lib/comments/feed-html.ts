// ── The edition, rendered for a feed reader and for email ────────────────────
//
// WHY THIS EXISTS. The RSS feed is the only distribution channel this
// publication has that costs nothing and needs no owner effort: MailerLite can
// point a recurring campaign at /comments/rss.xml and mail every edition to the
// subscriber list without anyone touching a dashboard again. A campaign built
// that way sends whatever the feed item contains, so a feed carrying a headline
// and a link produces an email nobody opens twice. This module builds the thing
// worth opening: the day's hero comment, the numbers, and each video with its
// own most-liked line.
//
// Two renderings, deliberately:
//   editionHtml  -> <content:encoded>, what an email client and a modern reader
//                   display. Inline styles only, no <style> block, no external
//                   CSS, no flex or grid, because Outlook and Gmail strip or
//                   ignore all of it.
//   editionText  -> <description>, the plain fallback for readers that take the
//                   first element they find.
//
// COMPLIANCE, not decoration. Every video links back to YouTube and names its
// channel (Required Minimum Functionality), and the disclosure line at the foot
// is YouTube's III.E.4.h requirement that derived metrics are identified as
// ours. Both travel with the item, because an email is read far from the page
// where the disclosure otherwise lives. Featured comment text in a sent email
// is a copy we cannot recall, which is exactly why the feed carries at most a
// handful of quotes and never a comment dump.
//
// House style: no em dashes in published copy.

import type { EditionBundle, VideoRow, FeaturedRow } from "./types";
import {
  absoluteUrl,
  editionPath,
  escapeXml,
  formatCount,
  formatEditionDate,
  pct,
  truncate,
  videoPath,
  youtubeWatchUrl,
} from "./render-helpers";

// Terracotta lead and warm neutrals, matching components/v2/tokens without
// importing it: this file must stay free of anything that pulls in React.
const INK = "#1c1917";
const MUTED = "#57534e";
const LEAD = "#b45309";
const RULE = "#e7e5e4";
const SURFACE = "#faf9f7";

const BODY = `margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${INK};`;
const SMALL = `margin:4px 0 0;font-size:13px;line-height:1.5;color:${MUTED};`;
const KICKER = `margin:0 0 6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${LEAD};`;

const DISCLOSURE =
  "Sentiment, themes and automation figures are PAID LLC's own estimates computed from public comments. " +
  "They are not YouTube metrics, and they describe each comment section in aggregate, never any individual account. " +
  "Not affiliated with or endorsed by YouTube.";

/** Escapes text for HTML. The five XML entities are exactly the set HTML needs. */
const esc = escapeXml;

function analyzed(bundle: EditionBundle): VideoRow[] {
  return bundle.videos.filter((v) => v.status === "analyzed");
}

function featuredFor(bundle: EditionBundle, videoId: string, role: FeaturedRow["role"]) {
  return bundle.featured
    .filter((f) => f.video_id === videoId && f.role === role && f.text)
    .sort((a, b) => a.position - b.position)[0];
}

/**
 * The comment, ready to sit inside quotation marks. Comments routinely end in a
 * trailing space or newline, which renders as a gap before the closing quote.
 */
function quoted(text: string, max = 0): string {
  const t = text.trim();
  return `"${max ? truncate(t, max) : t}"`;
}

function statLine(bundle: EditionBundle): string {
  const s = bundle.edition.stats ?? {};
  if (!s.commentsAnalyzed) return "";
  return (
    `${formatCount(s.commentsAnalyzed)} comments read across ` +
    `${s.videosAnalyzed ?? 0} videos. ` +
    `${pct(s.positiveShare ?? 0)} positive, ${pct(s.negativeShare ?? 0)} negative, ` +
    `about ${pct(s.automationShare ?? 0)} estimated automated.`
  );
}

/** "Alex, 2 likes" with the pieces that exist. Never an em dash. */
function attribution(f: FeaturedRow): string {
  const who = f.author_display?.trim();
  const likes = `${formatCount(f.like_count)} ${f.like_count === 1 ? "like" : "likes"}`;
  return who ? `${who}, ${likes}` : likes;
}

// ── HTML ─────────────────────────────────────────────────────────────────────

function quoteBlock(f: FeaturedRow, label: string, why?: string | null): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 18px;">
        <tr>
          <td style="padding:14px 16px;background:${SURFACE};border-left:3px solid ${LEAD};">
            <p style="${KICKER}">${esc(label)}</p>
            <p style="margin:0;font-size:17px;line-height:1.5;color:${INK};">${esc(quoted(f.text ?? ""))}</p>
            <p style="${SMALL}">${esc(attribution(f))}</p>
            ${why ? `<p style="${SMALL}">${esc(why)}</p>` : ""}
          </td>
        </tr>
      </table>`;
}

function videoBlock(bundle: EditionBundle, v: VideoRow): string {
  const permalink = absoluteUrl(videoPath(v.video_id));
  const watch = youtubeWatchUrl(v.video_id);
  const vph = v.stats?.views_per_hour;
  const meta = [esc(v.channel_title), vph ? `${formatCount(vph)} views/hr` : ""].filter(Boolean).join(" &middot; ");
  const top = featuredFor(bundle, v.video_id, "top");
  const funny = featuredFor(bundle, v.video_id, "funniest");
  const vibe = v.analysis?.vibe;

  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 26px;">
        <tr>
          <td style="padding:0 0 14px;border-bottom:1px solid ${RULE};">
            ${
              v.thumbnail_url
                ? `<a href="${esc(permalink)}"><img src="${esc(v.thumbnail_url)}" alt="" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:6px;margin:0 0 10px;"></a>`
                : ""
            }
            <p style="margin:0;font-size:16px;font-weight:600;line-height:1.4;">
              <a href="${esc(permalink)}" style="color:${INK};text-decoration:none;">${esc(v.title)}</a>
            </p>
            <p style="${SMALL}">${meta} &middot; <a href="${esc(watch)}" style="color:${LEAD};">Watch on YouTube</a></p>
            ${v.summary ? `<p style="margin:10px 0 0;">${esc(v.summary)}</p>` : ""}
            ${vibe ? `<p style="${SMALL}">Mood: ${esc(vibe)}</p>` : ""}
            ${top?.text ? `<p style="margin:10px 0 0;font-size:14px;">Most liked: ${esc(quoted(top.text, 180))} <span style="color:${MUTED};">(${esc(attribution(top))})</span></p>` : ""}
            ${funny?.text && funny.comment_id !== bundle.edition.hero_comment_id ? `<p style="margin:6px 0 0;font-size:14px;">Underrated: ${esc(quoted(funny.text, 180))} <span style="color:${MUTED};">(${esc(attribution(funny))})</span></p>` : ""}
          </td>
        </tr>
      </table>`;
}

/**
 * The full edition as email-safe HTML, for <content:encoded>.
 *
 * Returns a fragment, not a document: MailerLite and every feed reader wrap it
 * in their own template, and a nested <html> element is what makes a campaign
 * render as raw markup.
 */
export function editionHtml(bundle: EditionBundle): string {
  const { edition } = bundle;
  const url = absoluteUrl(editionPath(edition.edition_date));
  const hero = bundle.featured.find((f) => f.comment_id === edition.hero_comment_id && f.text);
  const videos = analyzed(bundle);
  const stats = statLine(bundle);

  return `<div style="${BODY}">
      <p style="${KICKER}">${esc(
        [edition.edition_no ? `Edition ${edition.edition_no}` : "", formatEditionDate(edition.edition_date)]
          .filter(Boolean)
          .join(" · ")
      )}</p>
      ${edition.headline ? `<h2 style="margin:0 0 10px;font-size:21px;line-height:1.35;color:${INK};">${esc(edition.headline)}</h2>` : ""}
      ${stats ? `<p style="margin:0 0 18px;color:${MUTED};">${esc(stats)}</p>` : ""}
      ${hero ? quoteBlock(hero, "Underrated comment of the day", hero.why) : ""}
      ${videos.length ? `<p style="${KICKER}">Today's ${videos.length === 1 ? "video" : "videos"}</p>` : ""}
      ${videos.map((v) => videoBlock(bundle, v)).join("")}
      <p style="margin:0 0 18px;">
        <a href="${esc(url)}" style="color:${LEAD};font-weight:600;">Read the full edition</a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">${esc(DISCLOSURE)}</p>
    </div>`;
}

// ── Plain text ───────────────────────────────────────────────────────────────

/** The same edition as plain text, for <description> and text-only clients. */
export function editionText(bundle: EditionBundle): string {
  const { edition } = bundle;
  const lines: string[] = [];

  if (edition.headline) lines.push(edition.headline);
  const stats = statLine(bundle);
  if (stats) lines.push(stats);

  const hero = bundle.featured.find((f) => f.comment_id === edition.hero_comment_id && f.text);
  if (hero) {
    lines.push(`Underrated comment of the day: ${quoted(hero.text ?? "")} (${attribution(hero)})`);
    if (hero.why) lines.push(hero.why);
  }

  const videos = analyzed(bundle);
  if (videos.length) {
    lines.push("Today's videos:");
    for (const v of videos) {
      const top = featuredFor(bundle, v.video_id, "top");
      const vph = v.stats?.views_per_hour ? `, ${formatCount(v.stats.views_per_hour)} views/hr` : "";
      lines.push(`- ${v.title} (${v.channel_title}${vph})`);
      if (top?.text) lines.push(`  Most liked: ${quoted(top.text, 160)} (${attribution(top)})`);
    }
  }

  lines.push(absoluteUrl(editionPath(edition.edition_date)));
  lines.push(DISCLOSURE);
  return lines.join("\n\n");
}
