// ── Sentiment scoring, in code ───────────────────────────────────────────────
// Every comment on this site is scored here, not by a model. Five videos a day
// is roughly 5,000 comments; sending those to Gemini would cost more than the
// rest of the site combined and would take minutes per video. This file does it
// in about a millisecond per thousand comments, for free, deterministically.
//
// The list is written for YouTube comment sections specifically, which is why it
// is not a stock lexicon. "mid", "cooked", "goat", "ratio", "ate" and "slaps"
// carry real polarity under a trending video and appear in no general-purpose
// word list; "sick" and "insane" lean POSITIVE here, the opposite of their
// dictionary sense. Weights run -5..5 and are deliberately coarse — the signal
// we need is "which way did the room lean", not a per-comment truth claim.
//
// Known limits, stated rather than hidden: no sarcasm detection (structurally
// out of reach for a lexicon), English only (isLikelyEnglish gates the caller),
// and no coreference. The aggregate is honest at the section level and noisy at
// the single-comment level, which is exactly how the page presents it.

/** Words that flip the polarity of what follows, within NEGATION_WINDOW tokens. */
export const NEGATORS = new Set([
  "not", "no", "never", "none", "cannot", "cant", "wont", "wouldnt", "shouldnt",
  "couldnt", "dont", "doesnt", "didnt", "isnt", "arent", "wasnt", "werent",
  "aint", "hardly", "barely", "without", "nobody", "nothing", "nowhere", "nor",
]);

/** Multipliers applied to the next scored word. */
export const INTENSIFIERS: Record<string, number> = {
  very: 1.5, really: 1.5, so: 1.4, super: 1.6, extremely: 1.9, incredibly: 1.8,
  absolutely: 1.8, totally: 1.5, completely: 1.6, utterly: 1.8, insanely: 1.8,
  ridiculously: 1.7, unbelievably: 1.8, deadass: 1.5, genuinely: 1.4, truly: 1.5,
  actually: 1.2, literally: 1.3, straight: 1.3, damn: 1.5, fucking: 1.8,
  freaking: 1.5, hella: 1.6, mad: 1.4, kinda: 0.5, sorta: 0.5, slightly: 0.4,
  somewhat: 0.5, barely: 0.4, a: 1.0, bit: 0.5, lowkey: 0.6, highkey: 1.4,
};

const NEGATION_WINDOW = 3;

/**
 * Weighted sentiment terms, -5..5. Grouped by intent so the list stays editable.
 * Keys are lowercase and apostrophe-free; tokenize() strips punctuation to match.
 */
export const LEXICON: Record<string, number> = {
  // ── Strong positive ────────────────────────────────────────────────────────
  masterpiece: 5, phenomenal: 5, flawless: 5, perfection: 5, breathtaking: 5,
  incredible: 4, amazing: 4, outstanding: 4, brilliant: 4, superb: 4,
  excellent: 4, fantastic: 4, wonderful: 4, beautiful: 4, gorgeous: 4,
  stunning: 4, legendary: 4, iconic: 4, genius: 4, perfect: 4, magnificent: 4,
  awesome: 3, great: 3, love: 3, loved: 3, loving: 3, adore: 3, favorite: 3,
  favourite: 3, best: 3, wholesome: 3, heartwarming: 3, inspiring: 3,
  impressive: 3, talented: 3, gifted: 3, deserved: 3, respect: 3, legend: 3,
  masterclass: 4, immaculate: 4, elite: 3, unmatched: 4, underrated: 3,
  // ── Moderate positive ─────────────────────────────────────────────────────
  good: 2, nice: 2, cool: 2, solid: 2, decent: 2, enjoyed: 2, enjoy: 2,
  happy: 2, glad: 2, fun: 2, funny: 2, hilarious: 3, cute: 2, sweet: 2,
  clever: 2, smart: 2, helpful: 2, useful: 2, clear: 2, honest: 2, kind: 2,
  brave: 2, strong: 2, proud: 2, grateful: 2, thankful: 2, thanks: 2,
  thank: 2, appreciate: 2, welcome: 1, agreed: 2, agree: 2, true: 1,
  worth: 2, quality: 2, smooth: 2, clean: 2, crisp: 2, satisfying: 3,
  relaxing: 2, calming: 2, comforting: 2, refreshing: 2, hopeful: 2,
  // ── Comment-section slang, positive ───────────────────────────────────────
  // Sense-inverted from the dictionary on purpose. Under a trending video these
  // are praise, and treating them as negative would flip whole sections.
  fire: 3, goat: 4, goated: 4, banger: 3, slaps: 3, slapped: 3, bussin: 3,
  ate: 3, cooking: 2, chef: 2, based: 2, peak: 3, hard: 1,
  sick: 2, insane: 2, nuts: 1, crazy: 1, wild: 1, unreal: 3, mint: 2,
  clutch: 3, carried: 2, carry: 2, king: 2, queen: 2, icon: 3, w: 2,
  dub: 2, vibes: 2, vibe: 2, valid: 2, solidified: 2, mother: 2,
  masterstroke: 4, chills: 3, goosebumps: 3, tears: 1, crying: 1,
  // ── Moderate negative ─────────────────────────────────────────────────────
  bad: -2, poor: -2, weak: -2, boring: -3, bland: -2, dull: -2, slow: -1,
  confusing: -2, unclear: -2, messy: -2, sloppy: -3, lazy: -3, rushed: -2,
  annoying: -3, irritating: -3, frustrating: -3, disappointing: -3,
  disappointed: -3, underwhelming: -3, overrated: -3, forced: -2, fake: -3,
  staged: -3, scripted: -2, clickbait: -3, misleading: -3, dishonest: -4,
  wrong: -2, false: -2, biased: -2, unfair: -2, rude: -3, mean: -2,
  disrespectful: -3, arrogant: -3, ignorant: -3, selfish: -3, greedy: -3,
  uncomfortable: -2, awkward: -1, cringe: -3, cringey: -3, cringeworthy: -3,
  mid: -2, flop: -3, flopped: -3, cooked: -2, washed: -3, l: -2,
  ratio: -2, yikes: -2, oof: -1, nope: -2, meh: -2, whatever: -1,
  // ── Strong negative ───────────────────────────────────────────────────────
  terrible: -4, awful: -4, horrible: -4, atrocious: -5, abysmal: -5,
  garbage: -4, trash: -4, worst: -4, pathetic: -4, disgusting: -4,
  disgusted: -4, appalling: -5, unacceptable: -4, unwatchable: -4,
  insufferable: -4, hate: -4, hated: -4, hateful: -4, despise: -4,
  toxic: -3, harmful: -3, dangerous: -3, scam: -4, scammer: -4, fraud: -4,
  stolen: -3, stole: -3, plagiarized: -4, copied: -2, ripoff: -4,
  shameful: -4, disgrace: -4, embarrassing: -3, humiliating: -3,
  tragic: -3, heartbreaking: -3, devastating: -3, horrifying: -4,
  sad: -2, angry: -3, furious: -4, upset: -2, hurt: -2, painful: -2,
  scared: -2, afraid: -2, worried: -2, anxious: -2, disturbing: -3,
  stupid: -3, dumb: -3, idiotic: -4, nonsense: -3, ridiculous: -2,
  useless: -3, pointless: -3, worthless: -4, waste: -3, wasted: -3,
  broken: -2, buggy: -2, failed: -2, failure: -3, mess: -2, disaster: -4,
};

/** Emoji polarity. Separate map because emoji never tokenize as words. */
export const EMOJI_VALENCE: Record<string, number> = {
  "😂": 3, "🤣": 3, "😹": 3, "😭": 1, "😅": 1, "😆": 2, "😄": 3, "😃": 3,
  "😀": 3, "😁": 3, "🙂": 2, "😊": 3, "☺️": 3, "😌": 2, "🥰": 4, "😍": 4,
  "🤩": 4, "😘": 3, "💖": 4, "💕": 3, "❤️": 4, "🧡": 3, "💛": 3, "💚": 3,
  "💙": 3, "💜": 3, "🖤": 2, "🤍": 3, "♥️": 4, "💗": 4, "💓": 3, "💞": 3,
  "🔥": 3, "💯": 4, "🙌": 3, "👏": 3, "👍": 3, "🤝": 2, "🫡": 2, "🙏": 2,
  "✨": 3, "🌟": 3, "⭐": 3, "🏆": 4, "🥇": 4, "👑": 3, "🐐": 4, "💪": 3,
  "🤯": 2, "😱": 1, "🥹": 2, "🥲": 1, "😳": 0, "👀": 0, "🤔": 0, "🫠": 0,
  "😐": -1, "😑": -1, "🙄": -2, "😒": -2, "😕": -2, "🙁": -2, "☹️": -2,
  "😞": -3, "😔": -3, "😟": -2, "😢": -2, "😖": -2, "😣": -2, "😫": -2,
  "😩": -2, "😤": -2, "😠": -3, "😡": -4, "🤬": -5, "🤮": -4, "🤢": -3,
  "💀": 2, "☠️": 1, "👎": -3, "🚮": -3, "🗑️": -3, "💩": -4, "🤡": -3,
  "😬": -1, "😰": -2, "😨": -2, "🥱": -2, "😴": -2, "🫤": -1,
};

/** Tokens that mark an attempt at a joke. Used by humor.ts, defined here so the
 *  vocabulary lives in one file. */
export const LAUGH_MARKERS = [
  "lol", "lmao", "lmfao", "rofl", "haha", "hahaha", "hehe", "heh", "lmaoo",
  "im dead", "i'm dead", "im crying", "i'm crying", "im done", "i'm done",
  "not me", "why is this", "the way", "nobody:", "me:", "pov", "bro said",
  "sir this is", "who else", "this comment", "underrated comment", "💀", "😂",
  "🤣", "😭",
];

/** Words carrying no polarity, dropped before theme extraction. */
export const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "all", "also", "am", "an", "and",
  "any", "are", "as", "at", "back", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "came", "can", "come", "could",
  "did", "do", "does", "doing", "down", "during", "each", "even", "ever",
  "every", "few", "for", "from", "further", "get", "gets", "getting", "go",
  "going", "got", "had", "has", "have", "having", "he", "her", "here", "hers",
  "herself", "him", "himself", "his", "how", "i", "if", "im", "in", "into",
  "is", "it", "its", "itself", "just", "know", "like", "ll", "made", "make",
  "many", "me", "might", "more", "most", "much", "must", "my", "myself", "need",
  "never", "new", "no", "nor", "not", "now", "of", "off", "on", "once", "one",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
  "put", "re", "really", "said", "same", "saw", "say", "says", "see", "seen",
  "she", "should", "since", "so", "some", "still", "such", "take", "than",
  "that", "thats", "the", "their", "theirs", "them", "themselves", "then",
  "there", "these", "they", "thing", "things", "think", "this", "those",
  "through", "to", "too", "under", "until", "up", "us", "use", "used", "ve",
  "very", "want", "was", "watch", "watching", "way", "we", "well", "went",
  "were", "what", "when", "where", "which", "while", "who", "whom", "why",
  "will", "with", "would", "you", "your", "yours", "yourself", "yourselves",
  "video", "guys", "guy", "youtube", "channel", "comment", "comments", "people",
  "actually", "literally", "basically", "definitely", "probably", "maybe",
  "something", "anything", "everything", "nothing", "someone", "everyone",
]);

/** Function words that mark a string as probably English. */
const ENGLISH_MARKERS = new Set([
  "the", "and", "is", "to", "of", "a", "in", "that", "it", "for", "was", "on",
  "with", "as", "this", "but", "his", "her", "you", "are", "be", "at", "have",
  "not", "they", "from", "or", "had", "by", "what", "when", "we", "i", "he",
  "she", "my", "me", "so", "just", "like", "all", "if", "would", "can", "im",
]);

/**
 * One WHOLE emoji per match, the way a reader sees it: a flag pair, or a
 * pictograph with its selectors, skin tone, and any zero-width-joined parts.
 * Matching code points one at a time split "🤦‍♂️" into a facepalm plus a bare
 * "♂", which edition 1 (2026-09-19) printed in its emoji row.
 */
const EMOJI_RE =
  /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})*)*/gu;

/** Extended_Pictographic includes these, but nobody reads them as emoji. */
const NOT_EMOJI = new Set(["©", "®", "™", "‼", "⁉"]);

/**
 * EMOJI_VALENCE keyed without the U+FE0F presentation selector. The table is
 * written with it ("❤️") but extraction strips it, so until 2026-09-19 six
 * entries, hearts included, never matched anything and never counted.
 */
const VALENCE = new Map(
  Object.entries(EMOJI_VALENCE).map(([k, v]) => [k.replace(/️/g, ""), v])
);

/** Valence of one extracted emoji; a ZWJ sequence falls back to its base. */
function emojiValence(e: string): number | undefined {
  return VALENCE.get(e) ?? VALENCE.get(String.fromCodePoint(e.codePointAt(0) ?? 0));
}

/**
 * Skin tones merge into the base emoji and a lone presentation selector is
 * dropped, so 👍🏽 and 👍, and ❤️ and ❤, each count as one thing on the page.
 * ZWJ sequences keep their selectors so they still render as one glyph.
 */
function normalizeEmoji(e: string): string {
  const noTone = e.replace(/\p{Emoji_Modifier}/gu, "");
  return noTone.includes("‍") ? noTone : noTone.replace(/️/g, "");
}

/**
 * Lowercases, strips punctuation, and splits into word tokens.
 * Apostrophes are removed rather than split, so "don't" -> "dont" and matches
 * the NEGATORS list.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Every emoji in a string, in order, including repeats. */
export function extractEmoji(text: string): string[] {
  const found = text.match(EMOJI_RE);
  if (!found) return [];
  return found.map(normalizeEmoji).filter((e) => e.length > 0 && !NOT_EMOJI.has(e));
}

/**
 * Sentiment of one comment, in [-1, 1].
 *
 * Raw weights are summed, then divided by sqrt(token count) so a long rant does
 * not automatically outweigh a short one, then squashed with tanh. The sqrt
 * (rather than a plain mean) is what keeps "garbage" and "this was absolute
 * garbage from start to finish" in the same neighbourhood instead of letting
 * padding dilute the second one to nearly neutral.
 */
export function scoreSentiment(text: string): number {
  if (!text) return 0;

  let raw = 0;
  let hits = 0;

  // Emoji first; they carry polarity independent of the sentence.
  for (const e of extractEmoji(text)) {
    const v = emojiValence(e);
    if (v !== undefined && v !== 0) {
      raw += v;
      hits++;
    }
  }

  const tokens = tokenize(text);
  for (let i = 0; i < tokens.length; i++) {
    const weight = LEXICON[tokens[i]];
    if (weight === undefined) continue;

    let value = weight;

    // An intensifier immediately before scales the term.
    const prev = tokens[i - 1];
    if (prev && INTENSIFIERS[prev] !== undefined) value *= INTENSIFIERS[prev];

    // A negator anywhere in the preceding window flips and dampens it:
    // "not great" is mildly negative, not the mirror image of "great".
    for (let back = 1; back <= NEGATION_WINDOW && i - back >= 0; back++) {
      if (NEGATORS.has(tokens[i - back])) {
        value *= -0.75;
        break;
      }
    }

    raw += value;
    hits++;
  }

  if (hits === 0) return 0;

  // Shouting amplifies whatever was already there.
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 6) {
    const upper = (text.match(/[A-Z]/g) ?? []).length;
    if (upper / letters.length > 0.7) raw *= 1.25;
  }

  // Exclamation marks add magnitude in the direction already established.
  const bangs = Math.min((text.match(/!/g) ?? []).length, 4);
  if (bangs > 0 && raw !== 0) raw += Math.sign(raw) * bangs * 0.25;

  const normalized = raw / Math.sqrt(Math.max(tokens.length, 1));
  return clamp(Math.tanh(normalized / 1.6), -1, 1);
}

/** Bucket a sentiment score. The 0.15 deadband keeps "ok" out of both camps. */
export function labelOf(score: number): "positive" | "neutral" | "negative" {
  if (score > 0.15) return "positive";
  if (score < -0.15) return "negative";
  return "neutral";
}

/**
 * Cheap English check. Two or more English function words, or a decent ratio of
 * ASCII letters with at least one marker. Emoji-only and non-Latin strings come
 * back false, which is the point: they are not scorable by this lexicon and the
 * caller skips a video whose section is mostly unscorable.
 */
export function isLikelyEnglish(text: string): boolean {
  const tokens = tokenize(text);
  if (tokens.length === 0) return false;

  let markers = 0;
  for (const t of tokens) if (ENGLISH_MARKERS.has(t)) markers++;
  if (markers >= 2) return true;

  // Short comments rarely contain two function words; fall back to script.
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const letters = text.replace(/[\s\d\p{P}\p{S}]/gu, "").length;
  if (letters === 0) return false;
  return latin / letters > 0.85 && (markers >= 1 || tokens.length <= 4);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
