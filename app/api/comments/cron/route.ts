export const runtime = "edge";

// ── POST /api/comments/cron?step=… ───────────────────────────────────────────
// The Comment Section's daily build, driven by .github/workflows/comment-section.yml
// at 12:05 UTC (07:05 Central in summer). Four steps, same x-cron-secret pattern
// as every other scheduled route here:
//
//   ?step=pick      choose the day's five videos, create the edition
//   ?step=video     process ONE video; the workflow loops until done:true
//   ?step=publish   aggregate, headline, flip to published
//   ?step=refresh   re-fetch stored YouTube data approaching its 30-day limit
//
// Why the work is split across requests rather than done in one: a single call
// doing five videos would hold a connection for ten minutes, and any failure in
// it would cost the whole edition. One video per request means a crash costs one
// card, and the claim in lib/comments/store.ts lets the next request resume.
//
// ?date=YYYY-MM-DD backfills a specific edition (workflow_dispatch). Without it
// the date is today in Central time, which is the publication's own boundary.
//
// Before db/01-comment-section.sql has been run this returns 200 with
// initialized:false, so a green workflow does not depend on the migration.

import { runCommentsStep, isStepName, editionDateToday } from "@/lib/comments/edition";
import { commentsReady } from "@/lib/comments/store";
import { isValidEditionDate } from "@/lib/comments/render-helpers";

export async function POST(req: Request) {
  if (!process.env.SUPABASE_URL) {
    return Response.json({ ok: false, reason: "comments unavailable" }, { status: 503 });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const step = url.searchParams.get("step");
  if (!isStepName(step)) {
    return Response.json(
      { ok: false, reason: "step must be one of pick, video, publish, refresh" },
      { status: 400 }
    );
  }

  const requested = url.searchParams.get("date");
  if (requested && !isValidEditionDate(requested)) {
    return Response.json({ ok: false, reason: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const date = requested ?? editionDateToday();

  // Green build, no work done: the tables are not there yet.
  if (!(await commentsReady())) {
    return Response.json({ ok: true, initialized: false, step, date });
  }

  const result = await runCommentsStep(step, date);
  const { http, ...body } = result;
  return Response.json({ ok: (http ?? 200) < 400, date, ...body }, { status: http ?? 200 });
}
