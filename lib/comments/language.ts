// ── Language, for the card, not the gate ────────────────────────────────────
// The picker does not drop a video for language. This module only decides
// whether the card should offer Translate.
//
// Signals, cheapest first, and none of them is a paid call:
//   1. YouTube snippet.defaultAudioLanguage / defaultLanguage, when set.
//   2. The title and description tells that used to be a rejection: another
//      script, "(Sub)", "Eng Sub", "digitally presented", a named language.
//   3. The share of fetched comments the lexicon already called English.
//   4. The featured comments on the card, for editions picked before any of
//      the above was stored.

/** Below this share of comments the lexicon can read, the card offers Translate. */
export const MIN_ENGLISH_RATIO = 0.4;

const FUNCTION_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with",
  "you", "your", "we", "they", "this", "that", "it", "its", "is", "are", "was",
  "were", "be", "have", "has", "just", "not", "what", "when", "from", "like",
  "my", "me", "i", "so", "if", "at", "as", "he", "she", "his", "her", "our",
]);

export interface LanguageInput {
  title: string;
  description?: string;
  defaultAudioLanguage?: string | null;
  defaultLanguage?: string | null;
  /** Share of fetched comments scored as English. Absent on a card that never stored it. */
  englishRatio?: number | null;
  /** Featured comment text already on the card. */
  commentTexts?: (string | null | undefined)[];
}

/** True when a YouTube language code is present and is not an English variant. */
export function youtubeLanguageIsEnglish(code: string | null | undefined): boolean | null {
  if (!code) return null;
  return code.toLowerCase().startsWith("en");
}

/**
 * Share of letters that are Latin script. 1 when there are too few letters
 * to judge, so a short title is never flagged on script alone.
 */
export function latinShare(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 4) return 1;
  return letters.filter((c) => /[A-Za-zÀ-ɏ]/.test(c)).length / letters.length;
}

/**
 * Title and description tells. These are display signals. A Latin-script drama
 * title with "(Sub)" (Mitti De Baway, 2026-10-16) and an "[Eng Sub]" upload
 * both land here, as does a description in another script under a translated title.
 */
export function textLooksNonEnglish(title: string, description = ""): boolean {
  if (latinShare(title) < 0.8) return true;
  if (/\beng(lish)?[\s-]*sub(s|bed|titles?)?\b/i.test(title)) return true;
  if (/\(\s*subs?\s*\)/i.test(title)) return true;
  if (/\bsubbed\b/i.test(title)) return true;
  if (/\bdigitally presented\b/i.test(title)) return true;
  if (/\b(hindi|urdu|punjabi|tamil|telugu|malayalam|bangla|bengali)\b/i.test(title)) return true;
  const letters = description.match(/\p{L}/gu) ?? [];
  if (letters.length >= 80 && latinShare(description) < 0.6) return true;
  return false;
}

/**
 * Featured comments, when that is all an older card still has.
 *
 * Another script is enough on its own. Latin-script comments (Roman Urdu,
 * Spanish) count only when several of them are long and none of them carries
 * ordinary English function words, so a short joke line cannot flip the card.
 */
export function commentsLookNonEnglish(texts: (string | null | undefined)[]): boolean {
  const cleaned = texts.map((t) => (t ?? "").trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) return false;

  const joined = cleaned.join("\n");
  const letters = joined.match(/\p{L}/gu) ?? [];
  if (letters.length >= 40) {
    const latin = letters.filter((c) => /[A-Za-zÀ-ɏ]/.test(c)).length;
    if (latin / letters.length < 0.6) return true;
  }

  const long = cleaned
    .map((t) => t.toLowerCase().match(/[a-z']{2,}/g) ?? [])
    .filter((tokens) => tokens.length >= 8);
  if (long.length < 3) return false;
  const englishish = long.filter(
    (tokens) => tokens.filter((w) => FUNCTION_WORDS.has(w)).length >= 2
  ).length;
  return englishish === 0;
}

/** Whether the card should offer Translate. Any one signal is enough. */
export function needsTranslation(input: LanguageInput): boolean {
  for (const code of [input.defaultAudioLanguage, input.defaultLanguage]) {
    const english = youtubeLanguageIsEnglish(code);
    if (english === false) return true;
  }
  if (textLooksNonEnglish(input.title, input.description ?? "")) return true;
  if (typeof input.englishRatio === "number" && input.englishRatio < MIN_ENGLISH_RATIO) return true;
  if (input.commentTexts && commentsLookNonEnglish(input.commentTexts)) return true;
  return false;
}

/** Google Translate of one of our pages. `pageUrl` is the absolute URL of that page. */
export function googleTranslatePageUrl(pageUrl: string): string {
  return `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(pageUrl)}`;
}
