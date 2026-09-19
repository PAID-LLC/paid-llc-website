/**
 * Checks everything The Comment Section needs before it can publish.
 *
 *   node --env-file=.env.local scripts/comments-preflight.mjs
 *
 * Run it after the setup steps and before pushing. It reads only; it creates
 * nothing, spends no Gemini tokens, and costs 1 YouTube quota unit of 10,000.
 *
 * It exists because the three preconditions fail in ways that look like silence
 * rather than errors. A missing table makes the cron return initialized:false
 * and exit GREEN having done nothing. A missing key makes the page render its
 * empty state, which is also what it does on a perfectly healthy day before the
 * first run. Neither shows up as a failure anywhere, so this asks directly.
 */

const OK = "  [ok]  ";
const NO = "  [--]  ";
let failures = 0;

function report(pass, label, detail) {
  console.log(`${pass ? OK : NO}${label}${detail ? `\n         ${detail}` : ""}`);
  if (!pass) failures++;
}

async function main() {
  console.log("\nThe Comment Section: preflight\n" + "=".repeat(52) + "\n");

  // ── 1. YouTube Data API ────────────────────────────────────────────────────
  const ytKey = process.env.YOUTUBE_API_KEY;
  if (!ytKey) {
    report(false, "YOUTUBE_API_KEY", "not set. Step 1 of SETUP-THIS.md.");
  } else if (ytKey.startsWith("AQ.")) {
    // A service-account-bound key, which the Cloud console creates when "Authenticate
    // API calls through a service account" is ticked. YouTube Data rejects the whole
    // type with a 401 reading "API keys are not supported by this API", which sounds
    // like a wrong key rather than a wrong KIND of key. Hit for real on 2026-09-19.
    report(
      false,
      "YOUTUBE_API_KEY",
      "this is a service-account-bound key (starts AQ.). YouTube Data only accepts a\n" +
        "         standard key (starts AIza). Create a new one with the service-account box UNticked."
    );
  } else {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&regionCode=US&maxResults=1&key=${ytKey}`
      );
      if (res.ok) {
        report(true, "YOUTUBE_API_KEY", "valid, and the most-popular chart responds.");
      } else {
        const body = await res.json().catch(() => ({}));
        const reason = body?.error?.errors?.[0]?.reason ?? `HTTP ${res.status}`;
        report(
          false,
          "YOUTUBE_API_KEY",
          reason === "accessNotConfigured"
            ? "the key works but YouTube Data API v3 is not enabled on that project."
            : `rejected: ${reason}`
        );
      }
    } catch (err) {
      report(false, "YOUTUBE_API_KEY", `network error: ${err.message}`);
    }
  }

  // ── 2. MailerLite group ────────────────────────────────────────────────────
  const group = process.env.MAILERLITE_COMMENTS_GROUP_ID;
  report(!!group, "MAILERLITE_COMMENTS_GROUP_ID", group ? `set to ${group}` : "not set. Step 3.");

  // ── 3. Gemini, which the site already had ──────────────────────────────────
  report(!!process.env.GEMINI_API_KEY, "GEMINI_API_KEY", "already in use by the rest of the site.");

  // ── 4. The three tables ────────────────────────────────────────────────────
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    report(false, "Supabase tables", "SUPABASE_URL / SUPABASE_SERVICE_KEY not set.");
  } else {
    for (const table of ["comment_editions", "comment_videos", "comment_featured"]) {
      try {
        const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        report(
          res.ok,
          `table ${table}`,
          res.ok ? "" : "missing. Run db/01-comment-section.sql in the SQL editor (Step 5)."
        );
      } catch (err) {
        report(false, `table ${table}`, err.message);
      }
    }
  }

  console.log("\n" + "=".repeat(52));
  if (failures === 0) {
    console.log("All clear locally. Remember the two Cloudflare variables are");
    console.log("separate from .env.local and bind at BUILD time, so they must");
    console.log("be saved BEFORE the push that deploys them.\n");
  } else {
    console.log(`${failures} thing(s) still to do. See projects/comment-section/SETUP-THIS.md`);
    console.log("in the Executive Assistant repo.\n");
    process.exitCode = 1;
  }
}

main();
