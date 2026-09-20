// ── Keeping the copy from sounding written by a machine ──────────────────────
//
// Three sentences a day come from a model: the teaser, the mood line on each
// card, and the line under the day's featured comment. Everything else on the
// page is computed. Those three are also the only sentences a reader judges the
// publication by, and after two editions they had already collapsed into
// formulas. Measured from what actually published:
//
//   TEASERS, 2 of 2:
//     "Find out why five videos and nearly four thousand comments just produced
//      some surprisingly human results."
//     "See why a strange camera angle sparked thousands of mostly human
//      comments today."
//   MOOD LINES, 8 of 10 opened "Viewers/Fans/Players are ...ing", and the word
//   "chaotic" appeared four times in ten sentences.
//   WHY LINES, 9 of 9 explained the joke: "is a brilliant twist", "is a spot-on
//   critique", "It perfectly captures", "It hilariously reframes".
//
// The teaser prompt asked for a sentence that would "make someone curious
// enough to click", so it produced a curiosity gap every time. The why line
// asked why a comment "lands", so it produced an explanation of the joke, which
// is the one thing you must never print beside a joke.
//
// Prompts alone cannot be trusted with this, because a model drifts back to its
// defaults and nobody rereads yesterday's teaser. So the tells below are checked
// in code, and a sentence carrying one is dropped rather than published. Every
// caller degrades gracefully: the teaser falls back to the templated headline,
// the mood line to a computed one, the why line to nothing at all, which on a
// card is simply a joke standing on its own.

/** A phrase that marks a sentence as machine-written, and what to call it. */
export interface Tell {
  name: string;
  re: RegExp;
}

export const AI_TELLS: Tell[] = [
  // The curiosity gap. Both teasers published so far opened this way.
  { name: "curiosity-gap", re: /\b(see|find out|here'?s|discover|learn) (why|how|what)\b/i },
  { name: "you-wont-believe", re: /\byou (won'?t|will not) believe\b/i },
  // "sparked thousands of debates", twice out of two.
  { name: "sparked", re: /\bspark(ed|s|ing)\b/i },
  // Appraisal instead of observation. All nine why lines did one of these.
  { name: "perfectly-captures", re: /\b(perfectly|beautifully|brilliantly) (captur|sum|encapsulat|illustrat)/i },
  { name: "spot-on", re: /\bspot[- ]on\b/i },
  { name: "is-a-masterclass", re: /\b(is|was) a masterclass\b/i },
  { name: "testament", re: /\ba testament to\b/i },
  { name: "adverb-appraisal", re: /\b(hilariously|cleverly|wittily|ingeniously) (reframe|recast|subvert|twist|captur)/i },
  { name: "brilliant-twist", re: /\b(a|an) (brilliant|clever|genius|inspired) (twist|take|observation|critique)\b/i },
  // Nobody says "the user" about a person whose name is printed beside the quote.
  { name: "the-user", re: /\bthe (user|commenter|poster) (adds|notes|points out|observes|jokes)\b/i },
  // Stock essay furniture.
  { name: "delve", re: /\bdelv(e|es|ing)\b/i },
  { name: "dive-into", re: /\b(dive|diving|deep dive) into\b/i },
  { name: "in-a-world", re: /\bin a world where\b/i },
  { name: "worth-noting", re: /\bit'?s worth noting\b/i },
  { name: "at-the-end-of-the-day", re: /\bat the end of the day\b/i },
  { name: "one-thing-is-clear", re: /\bone thing (is|was) clear\b/i },
  { name: "stark-reminder", re: /\ba stark reminder\b/i },
  { name: "speaks-volumes", re: /\bspeaks volumes\b/i },
  { name: "resonates", re: /\bresonat(e|es|ed|ing) with\b/i },
  { name: "buckle-up", re: /\bbuckle up\b/i },
  { name: "lets-be-honest", re: /\blet'?s be honest\b/i },
  { name: "goes-to-show", re: /\b(just )?goes to show\b/i },
  { name: "nothing-short-of", re: /\bnothing short of\b/i },
  // Our own overused words, from the measured sample.
  { name: "chaotic", re: /\bchaotic\b/i },
  { name: "unexpectedly-human", re: /\b(unexpectedly|surprisingly|mostly) human\b/i },
  { name: "internet-divided", re: /\bthe internet (is|was) (divided|torn)\b/i },
  { name: "left-viewers", re: /\b(left|has|had) (viewers|fans|users) (reeling|stunned|speechless|divided)\b/i },
];

/**
 * The opener that eight of ten mood lines used. Not banned outright, because it
 * is sometimes the plainest way to say what happened, but it cannot be the
 * house style, so the mood-line caller rejects it and takes the computed one.
 */
export const STOCK_MOOD_OPENER = /^(viewers|fans|players|commenters|the (room|section|comments)) (are|is|were|was)\b/i;

/** The first tell this sentence carries, or null if it reads as written by a person. */
export function machineTell(text: string): string | null {
  for (const tell of AI_TELLS) {
    if (tell.re.test(text)) return tell.name;
  }
  return null;
}

/** True when the sentence is clean enough to publish. */
export function readsHuman(text: string): boolean {
  return machineTell(text) === null;
}
