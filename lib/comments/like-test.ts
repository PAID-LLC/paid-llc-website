// ── The Like Test ────────────────────────────────────────────────────────────
//
// One question a day: three comments from the same video, which one got the
// most likes. The reader guesses, then sees the real counts.
//
// WHY THIS AND NOT A VOTE. The research that shaped it:
//
//   - A simulation comparing comment ranking across the three big platforms put
//     YouTube LAST, at 0.644 average upvotes per visitor against Hacker News's
//     0.899 and Reddit's 0.836, and found the same feedback loop on all three:
//     a comment that starts with few votes ranks low, so fewer people see it, so
//     it keeps few votes. Being unliked is mostly a fact about position.
//   - Across 2,147 subreddits the best answer had a single upvote 32% of the
//     time, and the first comment earned four times the karma regardless of
//     quality.
//   - For a publication, how OFTEN a reader returns predicts retention better
//     than how much they read. Wordle's shape is the proven one: a single small
//     finishable thing per day, not an endless feed.
//
// This publication's whole claim is that the top comment is not the best
// comment. A vote would ask readers to rank jokes, which is a popularity
// contest we would then be running ourselves, and Letterboxd shows where that
// ends: its own users describe a culture where short quippy one-liners collect
// the likes and anything observant gets nothing. The Like Test asks the
// opposite question. It makes the reader feel the gap between what is funny and
// what gets liked, which is the thesis, and it takes ten seconds.
//
// COST: nothing. It reuses comments already stored for the edition, the answer
// ships inside the page, and the streak lives in the reader's own browser. No
// new table, no API route, no owner setup, and nothing about a reader ever
// reaches us.

import type { EditionBundle, FeaturedRow } from "./types";

/**
 * Longest comment that can be a choice. Three options have to be scannable
 * side by side, and a four-line block beside two one-liners gives the answer
 * away before anyone has read them.
 */
const MAX_CHOICE_LEN = 220;

export interface LikeTestChoice {
  commentId: string;
  text: string;
  author: string | null;
  likes: number;
}

export interface LikeTest {
  videoId: string;
  videoTitle: string;
  channelTitle: string;
  /** Shuffled, so the answer is not always in the same position. */
  choices: LikeTestChoice[];
  /** Index into `choices` of the most-liked one. */
  answer: number;
}

/** Deterministic 32-bit hash, so the server and the browser shuffle alike. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toChoice(f: FeaturedRow): LikeTestChoice {
  return {
    commentId: f.comment_id,
    text: (f.text ?? "").trim(),
    author: f.author_display,
    likes: f.like_count,
  };
}

/**
 * Builds the day's question, or null when the edition cannot support a fair one.
 *
 * All three comments come from the SAME video on purpose. Comparing like counts
 * across videos would be a question about audience size rather than about the
 * comments, and the reader would be right to feel cheated by it.
 *
 * The mix is two of the video's most-liked comments plus its underrated pick.
 * That is the question worth asking: the one chosen for being funny is almost
 * always the one sitting at zero, and the two that collected thousands usually
 * are not jokes at all.
 */
export function buildLikeTest(bundle: EditionBundle): LikeTest | null {
  const analysed = bundle.videos.filter((v) => v.status === "analyzed");

  for (const video of analysed) {
    const mine = bundle.featured.filter(
      (f) =>
        f.video_id === video.video_id &&
        f.text &&
        f.text.trim().length > 0 &&
        !f.removed_at &&
        // The creator's own pinned comment always wins, which makes it a bad
        // question twice over: the answer is guessable from the verified name
        // beside it, and the interesting thing is what the ROOM liked.
        f.author_channel_id !== video.channel_id &&
        // Long comments are a visual giveaway next to two short ones, and the
        // full text has to be shown, so they are skipped rather than trimmed.
        f.text.trim().length <= MAX_CHOICE_LEN
    );

    const tops = mine
      .filter((f) => f.role === "top")
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 2);
    const underrated = mine.find((f) => f.role === "funniest");

    if (tops.length < 2 || !underrated) continue;

    // A question nobody can lose is not a question: the top two have to be
    // close enough that picking between them is a real guess.
    const [first, second] = tops;
    if (first.like_count === 0) continue;
    if (second.like_count / first.like_count < 0.25) continue;
    // And the underrated one has to actually be underrated, or the premise
    // shows through immediately.
    if (underrated.like_count > second.like_count * 0.1) continue;

    const picks = [first, second, underrated].map(toChoice);

    // Seeded by the date, so every reader gets the same arrangement and a
    // re-render never moves the answer.
    const rand = mulberry32(hashStr(bundle.edition.edition_date + video.video_id));
    for (let i = picks.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [picks[i], picks[j]] = [picks[j], picks[i]];
    }

    return {
      videoId: video.video_id,
      videoTitle: video.title,
      channelTitle: video.channel_title,
      choices: picks,
      answer: picks.findIndex((c) => c.commentId === first.comment_id),
    };
  }

  return null;
}
