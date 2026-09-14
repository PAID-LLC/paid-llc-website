// ── The Comment Section: shared shapes ───────────────────────────────────────
// Types only, no logic and no imports. Page components import from here so they
// never pull a lib module (and its fetch calls) into a render path.
//
// The load-bearing type in this file is VideoAnalysis. Read its comment before
// adding a field: it is the thing that gets persisted, and the retention design
// depends on it never carrying comment text or author identity.

/** One comment as fetched, before scoring. Lives in memory only. */
export interface CommentInput {
  id: string;
  text: string;
  authorDisplay: string;
  authorChannelId: string;
  authorAvatarUrl: string;
  likeCount: number;
  replyCount: number;
  publishedAt: string;
}

/** Public channel facts for a comment author, used by the automation scorer. */
export interface ChannelInfo {
  id: string;
  title: string;
  createdAt: string;
  subscriberCount: number | null;
  hiddenSubs: boolean;
  videoCount: number;
  avatarUrl: string;
}

/** A comment plus everything we computed about it. In memory only. */
export interface ScoredComment extends CommentInput {
  /** Sentiment in [-1, 1]. */
  sentiment: number;
  /** Automation likelihood 0-100. NEVER persisted, never rendered. */
  automation: number;
  /** Which automation signals fired. Aggregated, then discarded. */
  signals: string[];
  /** Humor ranking score; only meaningful among candidates. */
  humor: number;
}

/** A video as it comes off the most-popular chart. */
export interface VideoPick {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationS: number;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  liveBroadcastContent: string;
  defaultAudioLanguage: string | null;
  defaultLanguage: string | null;
}

/** Aggregate automation reading for one comment section. Aggregate ONLY. */
export interface AutomationSummary {
  /** Share of comments scoring >= 50. */
  shareLikely: number;
  /** Share scoring 30-49. */
  shareSuspicious: number;
  /** Signal name -> how many comments it fired on. */
  signals: Record<string, number>;
  /** Drops to "low" when channel lookups failed, so the UI can soften the claim. */
  confidence: "low" | "medium" | "high";
  uniqueAuthors: number;
  channelsResolved: number;
}

/**
 * Everything we keep about a comment section, and the only thing written to
 * comment_videos.analysis.
 *
 * INVARIANT, enforced by tests/api/comments-analyze.test.ts: no field here holds
 * comment text, an author display name, or a channel id. Featured comments are
 * stored separately (comment_featured) precisely so the 30-day refresh has a
 * small, well-known set of rows to walk. If you add a field that quotes a
 * commenter, you have moved that video off the refresh path and broken the
 * retention contract.
 */
export interface VideoAnalysis {
  /** How many comments were fetched and scored. */
  analyzed: number;
  positiveShare: number;
  neutralShare: number;
  negativeShare: number;
  /** Mean sentiment across the section, [-1, 1]. */
  meanSentiment: number;
  /** 10 bins from -1 to 1; counts, summing to `analyzed`. */
  histogram: number[];
  /** Frequent terms, most common first. Up to 12. */
  themes: string[];
  /** Top emoji with counts. */
  emoji: { char: string; count: number }[];
  /** 24 hourly buckets of comment counts since the video published. */
  velocity: number[];
  /** Index of the busiest velocity bucket. */
  busiestHour: number;
  automation: AutomationSummary;
  /** Share of comments that look like English. Below 0.4 the video is skipped. */
  englishRatio: number;
  /** Median and max likes, for the "underrated" framing. */
  medianLikes: number;
  maxLikes: number;
  /** What degraded on this run, e.g. "summary:text_fallback". */
  degraded: string[];
  /** Where the summary came from. */
  summarySource: "video" | "text" | "none";
  /** The mood sentence (Gemini, or a templated fallback). */
  vibe: string;
  /** YouTube quota units spent on this video. */
  ytUnits: number;
}

/** Token and latency accounting, keyed by which call it was. */
export type GeminiUsageMap = Record<string, { in: number; out: number; ms: number }>;

/** Strict JSON the editorial Gemini call must return. */
export interface EditorialJson {
  vibe: string;
  themes: string[];
  funniest: { index: number; why: string };
  runners_up: number[];
}

/** Per-edition aggregate, written to comment_editions.stats. */
export interface EditionStats {
  videosPicked: number;
  videosAnalyzed: number;
  videosSkipped: number;
  commentsAnalyzed: number;
  positiveShare: number;
  neutralShare: number;
  negativeShare: number;
  automationShare: number;
  /** Video ids holding the day's extremes, for headline templating. */
  mostPositive: string | null;
  mostNegative: string | null;
  mostAutomated: string | null;
  topEmoji: { char: string; count: number }[];
  busiestHour: number;
  ytUnits: number;
  geminiIn: number;
  geminiOut: number;
}

// ── Row shapes (PostgREST snake_case, as stored) ─────────────────────────────

export interface EditionRow {
  edition_date: string;
  edition_no: number | null;
  region: string;
  status: "building" | "published" | "failed";
  headline: string | null;
  teaser: string | null;
  video_ids: string[];
  hero_comment_id: string | null;
  stats: Partial<EditionStats>;
  published_at: string | null;
  created_at?: string;
}

export interface VideoRow {
  video_id: string;
  first_edition: string | null;
  rank: number | null;
  status: "pending" | "processing" | "analyzed" | "skipped";
  skip_reason: string | null;
  title: string;
  channel_id: string;
  channel_title: string;
  thumbnail_url: string | null;
  duration_s: number | null;
  published_at: string | null;
  stats: { views?: number; likes?: number; comments?: number; verified_at?: string; removed?: boolean };
  summary: string | null;
  analysis: Partial<VideoAnalysis>;
  gemini: GeminiUsageMap;
  refreshed_at?: string;
  updated_at?: string;
}

export interface FeaturedRow {
  comment_id: string;
  video_id: string;
  role: "funniest" | "runner_up" | "top";
  position: number;
  author_display: string | null;
  author_channel_id: string | null;
  text: string | null;
  like_count: number;
  published_at: string | null;
  why: string | null;
  refreshed_at?: string;
  removed_at?: string | null;
}

/** An edition plus its videos and their featured comments, ready to render. */
export interface EditionBundle {
  edition: EditionRow;
  videos: VideoRow[];
  featured: FeaturedRow[];
}

// ── Step machine ─────────────────────────────────────────────────────────────

export type StepName = "pick" | "video" | "publish" | "refresh";

export interface StepResult {
  step: StepName;
  /** True when the workflow's video loop should stop. */
  done?: boolean;
  /** Non-200 status the route should return (e.g. 409 while videos are pending). */
  http?: number;
  [k: string]: unknown;
}
