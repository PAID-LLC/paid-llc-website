// Turns a rendered blog article into speakable chunks for the "Listen" player.
// Browser speech synthesis (Chrome in particular) silently stops on long
// utterances, so long blocks are split at sentence boundaries.

export interface SpeechChunk {
  text: string;
  // Element to highlight while this chunk is spoken; null for the title.
  el: Element | null;
}

export const MAX_CHUNK_CHARS = 220;
const WORDS_PER_MINUTE = 165;

// Leaf blocks only: an <li> that wraps <p> tags is read through its <p>s.
const BLOCK_SELECTOR = "h2, h3, h4, p, li, td, th";

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function splitForSpeech(text: string, max = MAX_CHUNK_CHARS): string[] {
  const t = clean(text);
  if (t.length <= max) return t ? [t] : [];

  const sentences = t.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [t];
  const out: string[] = [];
  let buf = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > max) {
      if (buf) out.push(buf);
      buf = "";
      // A single run-on sentence: fall back to splitting on commas/spaces.
      let rest = s;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(", ", max);
        if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
        if (cut <= 0) cut = max;
        out.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      if (rest) buf = rest;
      continue;
    }
    if (buf && buf.length + 1 + s.length > max) {
      out.push(buf);
      buf = s;
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function extractSpeechChunks(
  root: Element,
  title?: string
): SpeechChunk[] {
  const chunks: SpeechChunk[] = [];
  if (title) chunks.push({ text: clean(title), el: null });

  for (const el of Array.from(root.querySelectorAll(BLOCK_SELECTOR))) {
    if (el.closest("pre")) continue;
    if (el.tagName === "LI" && el.querySelector("p")) continue;
    for (const text of splitForSpeech(el.textContent ?? "")) {
      chunks.push({ text, el });
    }
  }
  return chunks;
}

export function estimateListenMinutes(chunks: SpeechChunk[], rate = 1): number {
  const words = chunks.reduce(
    (n, c) => n + c.text.split(" ").filter(Boolean).length,
    0
  );
  return Math.max(1, Math.round(words / (WORDS_PER_MINUTE * rate)));
}

// Prefer the more natural-sounding English voices browsers ship.
export function pickVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (en.length === 0) return null;
  const preferred = [/natural/i, /google us english/i, /samantha/i, /aria/i, /jenny/i];
  for (const re of preferred) {
    const match = en.find((v) => re.test(v.name));
    if (match) return match;
  }
  return en.find((v) => v.lang === "en-US") ?? en[0];
}
