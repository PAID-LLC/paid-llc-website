/**
 * The Comment Section, run against the real APIs, writing nothing.
 *
 *   npx tsx --env-file=.env.local scripts/comments-dry-run.ts            # today's picks
 *   npx tsx --env-file=.env.local scripts/comments-dry-run.ts <videoId>  # one full analysis
 *
 * WHY THIS EXISTS AND WHY IT MATTERS MORE THAN THE UNIT TESTS. Everything the
 * tests cover is stubbed. Three things can only be learned by calling Google:
 *
 *   1. Whether videoMetadata clipping actually reduces the token count for a
 *      YouTube URL. The whole cost argument (35k tokens per video rather than
 *      180k) rests on it, the feature is in preview, and nothing fails loudly if
 *      the parameter is ignored. This script prints promptTokenCount so the
 *      answer is a number rather than an assumption.
 *   2. Whether the lexicon says anything sensible about a real comment section,
 *      as opposed to the synthetic fixtures in the tests.
 *   3. What a real digest looks like, and whether Gemini's pick is any good.
 *
 * IT WRITES NOTHING. Supabase credentials are blanked immediately after the env
 * file loads, so every guard in store.ts and usage-guard.ts fails open and no
 * row is created. That also means the daily budget counters are NOT decremented
 * here, so a dry run does not eat the morning's allowance. It does spend real
 * YouTube quota (about 27 units) and real Gemini tokens (about five cents).
 */

import { fetchCandidatePool, fetchCommentThreads, fetchChannels, fetchVideoDetails } from "../lib/comments/youtube";
import { analyzeVideo } from "../lib/comments/analyze";
import { geminiVideoSummary, geminiEditorial, buildDigest, fallbackEditorial } from "../lib/comments/gemini";
import { choosePicks, viewsPerHour } from "../lib/comments/edition";
import { signalLabel } from "../lib/comments/bots";
import { formatCount, pct } from "../lib/comments/render-helpers";

// Blank Supabase BEFORE importing anything that might read it at call time.
// Every store.ts path checks supabaseReady() and returns null; every counter in
// usage-guard.ts fails open and returns true. Nothing is written, nothing is spent.
process.env.SUPABASE_URL = "";
process.env.SUPABASE_SERVICE_KEY = "";

const bar = (n: number, width = 24) =>
  "█".repeat(Math.round(n * width)).padEnd(width, "·");

async function main() {
  if (!process.env.YOUTUBE_API_KEY) {
    console.error("YOUTUBE_API_KEY is not set. Add it to .env.local and pass --env-file=.env.local");
    process.exit(1);
  }

  const arg = process.argv[2];
  if (!arg) return showPicks();
  return analyseOne(arg);
}

/** No argument: show what today's edition WOULD pick, and why it rejected the rest. */
async function showPicks() {
  console.log("\nBuilding the candidate pool (11 charts + 2 searches, ~215 quota units)...\n");
  const pool = await fetchCandidatePool("US");
  const now = Date.now();
  const { picked, rejected, rejectedCounts } = await choosePicks(pool.videos, now);

  console.log(`POOL: ${pool.videos.length} unique videos`);
  console.log(`  ${Object.entries(pool.sources).map(([k, n]) => `${k} +${n}`).join("  ")}\n`);

  console.log(`WOULD PICK (${picked.length}), fastest-rising first:`);
  for (const v of picked) {
    console.log(
      `  ✓ ${v.videoId}  ${v.title.slice(0, 50).padEnd(50)} ${formatCount(Math.round(viewsPerHour(v, now)))}/hr, ` +
        `${formatCount(v.views)} views, ${formatCount(v.comments)} comments`
    );
  }
  if (picked.length === 0) console.log("  nothing survived the filter");

  console.log(`\nREJECTED ahead of the last pick: ${JSON.stringify(rejectedCounts)}`);
  for (const r of rejected) console.log(`  ✗ ${r.id}  ${r.title.slice(0, 50).padEnd(50)} ${r.rule}`);
  console.log(`\nRe-run with a video id for a full analysis.\n`);
}

/** With an id: run the whole per-video pipeline and print every intermediate. */
async function analyseOne(videoId: string) {
  const t0 = Date.now();

  const [video] = await fetchVideoDetails([videoId]);
  if (!video) {
    console.error(`No such video: ${videoId}`);
    process.exit(1);
  }

  console.log(`\n${"═".repeat(76)}`);
  console.log(video.title);
  console.log(`${video.channelTitle} · ${formatCount(video.views)} views · ${formatCount(video.comments)} comments`);
  console.log("═".repeat(76));

  console.log("\nFetching comments (up to 10 pages)...");
  const comments = await fetchCommentThreads(videoId, 10);
  console.log(`  ${comments.length} comments`);

  console.log("Fetching author channels...");
  const authors = [...new Set(comments.map((c) => c.authorChannelId).filter(Boolean))];
  const channels = await fetchChannels(authors);
  console.log(`  ${channels.size} of ${authors.length} resolved`);

  const ytUnits = Math.ceil(comments.length / 100) + Math.ceil(authors.length / 50) + 1;

  // ── Code, not model ────────────────────────────────────────────────────────
  const tAnalyze = Date.now();
  const { analysis, top, candidates } = analyzeVideo(
    { videoId, title: video.title, publishedAt: video.publishedAt },
    comments,
    channels
  );
  const analyzeMs = Date.now() - tAnalyze;

  console.log(`\n── ANALYSIS (all in code, ${analyzeMs}ms, $0) ${"─".repeat(28)}`);
  console.log(`  positive  ${bar(analysis.positiveShare)} ${pct(analysis.positiveShare)}`);
  console.log(`  neutral   ${bar(analysis.neutralShare)} ${pct(analysis.neutralShare)}`);
  console.log(`  negative  ${bar(analysis.negativeShare)} ${pct(analysis.negativeShare)}`);
  console.log(`\n  English:   ${pct(analysis.englishRatio)}  ${analysis.englishRatio < 0.4 ? "(WOULD BE SKIPPED)" : ""}`);
  console.log(`  automated: ${pct(analysis.automation.shareLikely)} likely, ${pct(analysis.automation.shareSuspicious)} suspicious (confidence: ${analysis.automation.confidence})`);
  for (const [sig, count] of Object.entries(analysis.automation.signals).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`      ${String(count).padStart(4)}  ${signalLabel(sig)}`);
  }
  console.log(`\n  themes:    ${analysis.themes.slice(0, 8).join(", ")}`);
  console.log(`  emoji:     ${analysis.emoji.map((e) => `${e.char} ${e.count}`).join("   ")}`);
  console.log(`  likes:     median ${analysis.medianLikes}, max ${formatCount(analysis.maxLikes)}`);
  console.log(`  busiest:   hour ${analysis.busiestHour} after upload`);
  console.log(`  shortlist: ${candidates.length} candidates, ${top.length} most-liked`);

  // ── Model call 1 ───────────────────────────────────────────────────────────
  console.log(`\n── GEMINI 1: watching the video ${"─".repeat(42)}`);
  const summaryCall = await geminiVideoSummary(videoId, video.title);
  if (summaryCall) {
    console.log(`  ${summaryCall.text}`);
    console.log(`\n  tokens: ${summaryCall.usage.in.toLocaleString()} in, ${summaryCall.usage.out} out · ${(summaryCall.usage.ms / 1000).toFixed(1)}s`);
    // The number this script exists to print. Clipping to 12 minutes at 0.25 fps
    // should land near 35k. Much higher means videoMetadata was ignored and the
    // cost model needs revisiting before this ships.
    const expected = 35_000;
    const ratio = summaryCall.usage.in / expected;
    console.log(
      ratio > 2
        ? `  ⚠ ${ratio.toFixed(1)}x the expected ~${expected.toLocaleString()} input tokens — clipping may not be applying`
        : `  ✓ within expectations for a clipped 12-minute pass`
    );
  } else {
    console.log("  FAILED — the text fallback would run here");
  }

  // ── Model call 2 ───────────────────────────────────────────────────────────
  const digest = buildDigest(video.title, summaryCall?.text ?? null, analysis, top, candidates);
  console.log(`\n── DIGEST (${digest.length.toLocaleString()} chars, ~${Math.round(digest.length / 4).toLocaleString()} tokens) ${"─".repeat(20)}`);
  console.log(digest.split("\n").slice(0, 12).join("\n"));
  console.log(`  ... ${digest.split("\n").length - 12} more lines`);

  console.log(`\n── GEMINI 2: the editorial pick ${"─".repeat(41)}`);
  const editorialCall = await geminiEditorial(digest, candidates.length);
  const editorial = editorialCall?.editorial ?? fallbackEditorial(analysis, candidates);
  if (!editorialCall) console.log("  FAILED — showing the deterministic fallback instead");

  console.log(`  vibe:   ${editorial.vibe}`);
  console.log(`  themes: ${editorial.themes.join(", ")}`);

  const winner = candidates[editorial.funniest.index];
  if (winner) {
    console.log(`\n  UNDERRATED COMMENT OF THE DAY (${winner.likeCount} likes)`);
    console.log(`  ${"┄".repeat(72)}`);
    console.log(`  "${winner.text}"`);
    console.log(`     — ${winner.authorDisplay}`);
    console.log(`  ${"┄".repeat(72)}`);
    console.log(`  why: ${editorial.funniest.why || "(fallback: no reason generated)"}`);
  }

  for (const idx of editorial.runners_up) {
    const r = candidates[idx];
    if (r) console.log(`\n  runner-up (${r.likeCount} likes): "${r.text.slice(0, 100)}"`);
  }

  if (editorialCall) {
    console.log(`\n  tokens: ${editorialCall.usage.in.toLocaleString()} in, ${editorialCall.usage.out} out · ${(editorialCall.usage.ms / 1000).toFixed(1)}s`);
  }

  // ── The bill ───────────────────────────────────────────────────────────────
  const tokensIn = (summaryCall?.usage.in ?? 0) + (editorialCall?.usage.in ?? 0);
  const tokensOut = (summaryCall?.usage.out ?? 0) + (editorialCall?.usage.out ?? 0);
  const usd = (tokensIn * 0.1 + tokensOut * 0.4) / 1_000_000;

  console.log(`\n${"═".repeat(76)}`);
  console.log(`TOTAL for one video: ${ytUnits} YouTube quota units of 10,000`);
  console.log(`                     ${tokensIn.toLocaleString()} in / ${tokensOut.toLocaleString()} out tokens`);
  console.log(`                     $${usd.toFixed(4)} at flash-lite list prices`);
  console.log(`                     ${((Date.now() - t0) / 1000).toFixed(1)}s wall clock`);
  console.log(`A five-video edition: ~${ytUnits * 5} units, ~$${(usd * 5).toFixed(3)}`);
  console.log(`Nothing was written to Supabase.`);
  console.log("═".repeat(76) + "\n");
}

main().catch((err) => {
  console.error("\nDry run failed:", err);
  process.exit(1);
});
