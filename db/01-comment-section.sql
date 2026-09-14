-- ── The Comment Section: a daily publication ─────────────────────────────────
-- Spec: cowork references/autoresearch/2026-09-11-comment-section-plan-v3-final.md
--
-- WHY THIS EXISTS. The measured problem is distribution: 2 lifetime customers and
-- roughly 70 blog views ever, against a 2026 search landscape where owned-site SEO
-- is structurally collapsing. Every other surface on this site is a thing we made
-- once. This is the first one that makes something new every morning without an
-- owner touching it: the day's most-viewed public videos, read through their
-- comment sections, with the funniest overlooked comment pulled to the top.
--
-- WHAT IS NOT STORED, AND WHY THAT IS THE WHOLE DESIGN.
--   YouTube's API Services Terms (III.E.4.c) require that stored API data be
--   refreshed or deleted within 30 calendar days. Rather than build a deletion
--   sweep over a comment warehouse, this schema never creates the warehouse:
--   ~1,000 comments per video are fetched, scored, and thrown away inside a single
--   request. What persists is (a) OUR derived analysis, which is ours forever, and
--   (b) at most SIX featured comments per video, held by id.
--
--   Those six rows and comment_videos.stats are the only YouTube-owned data here,
--   and both carry refreshed_at with a partial index behind it. The last step of
--   every daily run re-fetches anything older than 25 days by id (1 quota unit per
--   50 rows), which leaves five days of retry room against the 30-day boundary. A
--   comment that has been deleted upstream gets its text NULLed and removed_at set;
--   the page then shows "since removed" above our own commentary, which is the
--   honest rendering and also the compliant one.
--
-- WHAT IS DELIBERATELY ABSENT: a per-comment automation score. Bot detection runs
-- in memory and only its AGGREGATE survives ("about 14% automated"). There is no
-- column here that could ever put the word "bot" next to a named person's account,
-- because calling a named account automated is a factual claim about a human being
-- and we are not in a position to make it. A unit test asserts that serialized
-- analysis contains no comment text, display name, or channel id.
--
-- Safe to re-run: every CREATE is IF NOT EXISTS, every policy DROPs first.

-- ── 1. Editions ──────────────────────────────────────────────────────────────
-- One row per day. Built by the four-step cron machine in lib/comments/edition.ts:
-- pick (creates this row as 'building') -> video xN -> publish (flips to
-- 'published') -> refresh. A half-built edition is never readable by the site,
-- which only ever selects status='published'.
CREATE TABLE IF NOT EXISTS comment_editions (
  edition_date    DATE PRIMARY KEY,
  -- Human-facing issue number ("No. 12"), assigned at publish time as the count of
  -- already-published editions + 1. Null while building.
  edition_no      INT,
  region          TEXT        NOT NULL DEFAULT 'US',
  status          TEXT        NOT NULL DEFAULT 'building',
  -- Templated from the day's own numbers in lib/comments/headline.ts. No LLM.
  headline        TEXT,
  -- One short Gemini line for the OG card and social. Falls back to headline.
  teaser          TEXT,
  -- Analyzed video ids in rank order once published; all five picks while building.
  video_ids       TEXT[]      NOT NULL DEFAULT '{}',
  -- The edition-wide Underrated Comment: funniest of the day's picks with the
  -- fewest likes. FK-less on purpose — comment_featured rows can be cascade-deleted
  -- when a video row goes, and an edition should survive that with a null hero.
  hero_comment_id TEXT,
  -- EditionStats (ours): comments_analyzed, sentiment shares, automation share,
  -- busiest_hour, top_emoji, yt_units, gemini token totals.
  stats           JSONB       NOT NULL DEFAULT '{}',
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comment_editions_status_check
    CHECK (status IN ('building', 'published', 'failed'))
);

-- ── 2. Videos ────────────────────────────────────────────────────────────────
-- One row per video ever analyzed, keyed by the YouTube id so a video can never be
-- picked twice. 'processing' is the claim marker that makes the video step safe to
-- retry: a request that dies mid-run leaves the row claimed, and it becomes
-- re-claimable after ten minutes rather than wedging the edition.
CREATE TABLE IF NOT EXISTS comment_videos (
  video_id       TEXT PRIMARY KEY,
  first_edition  DATE        REFERENCES comment_editions(edition_date),
  rank           SMALLINT,
  status         TEXT        NOT NULL DEFAULT 'pending',
  -- 'comments_disabled' | 'too_few_comments' | 'non_english_comments' | 'api_error'
  skip_reason    TEXT,

  title          TEXT        NOT NULL,
  channel_id     TEXT        NOT NULL,
  channel_title  TEXT        NOT NULL,
  thumbnail_url  TEXT,
  duration_s     INT,
  published_at   TIMESTAMPTZ,

  -- YouTube-owned. {views, likes, comments, verified_at}. On the refresh path.
  stats          JSONB       NOT NULL DEFAULT '{}',
  -- Ours (Gemini video understanding). Nullable: a Gemini failure degrades the
  -- card, it does not skip the video.
  summary        TEXT,
  -- Ours. VideoAnalysis: sentiment shares + histogram, themes, emoji, velocity,
  -- automation summary, english_ratio, degraded[]. Derived only — no comment text.
  analysis       JSONB       NOT NULL DEFAULT '{}',
  -- Token and latency accounting per Gemini call, so /api/econ/status can price it.
  gemini         JSONB       NOT NULL DEFAULT '{}',

  refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comment_videos_status_check
    CHECK (status IN ('pending', 'processing', 'analyzed', 'skipped'))
);

-- ── 3. Featured comments ─────────────────────────────────────────────────────
-- The only place comment text is persisted, and the reason the refresh step exists.
-- Six rows per analyzed video: one 'funniest', two 'runner_up', three 'top'.
CREATE TABLE IF NOT EXISTS comment_featured (
  comment_id        TEXT PRIMARY KEY,
  video_id          TEXT        NOT NULL REFERENCES comment_videos(video_id) ON DELETE CASCADE,
  role              TEXT        NOT NULL,
  position          SMALLINT    NOT NULL DEFAULT 0,

  author_display    TEXT,
  author_channel_id TEXT,
  -- NULLed by the refresh step when the comment no longer exists upstream.
  text              TEXT,
  like_count        INT         NOT NULL DEFAULT 0,
  published_at      TIMESTAMPTZ,
  -- Ours (editorial): one sentence on why the funniest one lands. 'funniest' only.
  why               TEXT,

  refreshed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT comment_featured_role_check
    CHECK (role IN ('funniest', 'runner_up', 'top'))
);

-- ── 4. Indexes, one per real read path ───────────────────────────────────────
-- "the latest published edition" and "this date's edition"
CREATE INDEX IF NOT EXISTS comment_editions_status_date_idx
  ON comment_editions (status, edition_date DESC);

-- "the videos in this edition, in order"
CREATE INDEX IF NOT EXISTS comment_videos_first_edition_rank_idx
  ON comment_videos (first_edition, rank);

-- "claim the next unprocessed video" — partial, so it stays tiny (<=5 live rows)
CREATE INDEX IF NOT EXISTS comment_videos_pending_idx
  ON comment_videos (first_edition, updated_at)
  WHERE status IN ('pending', 'processing');

-- "which video stats are due for their 30-day re-verification"
CREATE INDEX IF NOT EXISTS comment_videos_refreshed_idx
  ON comment_videos (refreshed_at)
  WHERE status = 'analyzed';

-- "the featured comments for these videos, grouped by role"
CREATE INDEX IF NOT EXISTS comment_featured_video_role_idx
  ON comment_featured (video_id, role, position);

-- "which comments are due for their 30-day re-fetch" — the compliance read path
CREATE INDEX IF NOT EXISTS comment_featured_refreshed_idx
  ON comment_featured (refreshed_at)
  WHERE removed_at IS NULL;

-- ── 5. RLS: deny-all, service key only ───────────────────────────────────────
-- Matches db/harden-rls-policies.sql. The app is 100% service-key, which BYPASSES
-- RLS, so a deny-all policy is zero-impact hardening. Never write a USING(true)
-- "service_role_all" policy here — that GRANTS anon full access.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['comment_editions', 'comment_videos', 'comment_featured'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'deny_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (false) WITH CHECK (false)', 'deny_all', t);
  END LOOP;
END $$;

-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect three table names and three rows with relrowsecurity = true. Zero data
-- rows is correct until the first cron run; the site renders an empty state.
--
-- SELECT to_regclass('public.comment_editions'),
--        to_regclass('public.comment_videos'),
--        to_regclass('public.comment_featured');
--
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname LIKE 'comment\_%';
--
-- After the first run:
-- SELECT edition_date, edition_no, status, stats->>'comments_analyzed' AS comments
--   FROM comment_editions ORDER BY edition_date DESC LIMIT 5;
-- SELECT video_id, status, skip_reason, left(summary, 60) FROM comment_videos
--   WHERE first_edition = current_date ORDER BY rank;
--
-- Compliance spot-check (should always return 0 rows; anything here is past due):
-- SELECT count(*) FROM comment_featured
--   WHERE removed_at IS NULL AND refreshed_at < now() - interval '30 days';
