export const runtime = "edge";

// ── GET /api/comments/edition ────────────────────────────────────────────────
// Today's edition as JSON, or ?date=YYYY-MM-DD for a specific one.
//
// Public and unauthenticated, matching the rest of this site's agent-facing
// surface: paiddev.com publishes its own data rather than making agents scrape
// the HTML for it. It is also how deploy verification checks that the morning's
// cron actually produced something, without opening a browser.
//
// Featured comments carry their YouTube attribution inline (author, permalink),
// because a JSON consumer has the same obligation to credit the source as the
// page does, and this is the only place to tell them so.

import { getEditionBundle } from "@/lib/comments/store";
import { isValidEditionDate, youtubeWatchUrl } from "@/lib/comments/render-helpers";

export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("date");
  if (requested && !isValidEditionDate(requested)) {
    return Response.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const bundle = await getEditionBundle(requested ?? "latest");
  if (!bundle) {
    return Response.json(
      { error: "no published edition", hint: "The first edition publishes at 12:05 UTC." },
      { status: 404, headers: { "Cache-Control": "public, max-age=60" } }
    );
  }

  const { edition, videos, featured } = bundle;

  return Response.json(
    {
      edition_date: edition.edition_date,
      edition_no: edition.edition_no,
      headline: edition.headline,
      teaser: edition.teaser,
      url: `https://paiddev.com/comments/${edition.edition_date}`,
      published_at: edition.published_at,
      stats: edition.stats,
      videos: videos
        .filter((v) => v.status === "analyzed")
        .map((v) => ({
          video_id: v.video_id,
          title: v.title,
          channel: v.channel_title,
          youtube_url: youtubeWatchUrl(v.video_id),
          permalink: `https://paiddev.com/comments/v/${v.video_id}`,
          summary: v.summary,
          analysis: {
            comments_analyzed: v.analysis.analyzed,
            positive_share: v.analysis.positiveShare,
            neutral_share: v.analysis.neutralShare,
            negative_share: v.analysis.negativeShare,
            automation_share: v.analysis.automation?.shareLikely,
            automation_confidence: v.analysis.automation?.confidence,
            themes: v.analysis.themes,
            vibe: v.analysis.vibe,
          },
          featured: featured
            .filter((f) => f.video_id === v.video_id)
            .map((f) => ({
              role: f.role,
              text: f.text,
              author: f.author_display,
              like_count: f.like_count,
              why: f.why,
              removed: !!f.removed_at,
              youtube_url: youtubeWatchUrl(v.video_id, f.comment_id),
            })),
        })),
      skipped: videos
        .filter((v) => v.status === "skipped")
        .map((v) => ({ video_id: v.video_id, title: v.title, reason: v.skip_reason })),
      disclosure:
        "Sentiment, themes and automation figures are PAID LLC's own estimates computed " +
        "from public comments. They are not YouTube metrics, and they describe each " +
        "comment section in aggregate, never any individual account. Comment text, video " +
        "titles and statistics come from YouTube and belong to their authors. " +
        "Not affiliated with or endorsed by YouTube. Method: https://paiddev.com/comments/about",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}
