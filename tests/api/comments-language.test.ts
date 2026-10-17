/**
 * Language is a card signal, not a pick rule.
 *
 * YouTube's language codes win when they are set. Titles and featured comments
 * cover the cards that were published before those codes were stored, including
 * Mitti De Baway, whose "(Sub)" title and Roman Urdu comments cleared the old
 * English-ratio skip.
 */

import { describe, it, expect } from "vitest";
import {
  commentsLookNonEnglish,
  googleTranslatePageUrl,
  needsTranslation,
  textLooksNonEnglish,
} from "@/lib/comments/language";

describe("needsTranslation", () => {
  it("trusts a YouTube language code, including regional English", () => {
    expect(needsTranslation({ title: "A Rising Video", defaultAudioLanguage: "es" })).toBe(true);
    expect(needsTranslation({ title: "A Rising Video", defaultLanguage: "ja" })).toBe(true);
    expect(needsTranslation({ title: "A Rising Video", defaultAudioLanguage: "en-GB" })).toBe(false);
    expect(needsTranslation({ title: "A Rising Video", defaultAudioLanguage: "EN" })).toBe(false);
  });

  it("flags the title tells that used to be a rejection", () => {
    expect(textLooksNonEnglish("Nashtar Episode 09 [Eng Sub] Digitally Presented")).toBe(true);
    expect(textLooksNonEnglish("Mitti De Baway Ep 08 (Sub) 15 Oct 26 | Green TV")).toBe(true);
    expect(textLooksNonEnglish("អាបឺតនេះ រឿង")).toBe(true);
    expect(textLooksNonEnglish("A Punjabi hit", "ਇ".repeat(80))).toBe(true);
    expect(textLooksNonEnglish("ROSÉ - new trick (OFFICIAL MUSIC VIDEO)")).toBe(false);
  });

  it("flags a thin English ratio and a comment section in another script", () => {
    expect(needsTranslation({ title: "A Rising Video", englishRatio: 0.2 })).toBe(true);
    expect(needsTranslation({ title: "A Rising Video", englishRatio: 0.4 })).toBe(false);
    expect(needsTranslation({ title: "A Rising Video", englishRatio: 0.91 })).toBe(false);
    expect(
      commentsLookNonEnglish([
        "यह वीडियो बहुत अच्छा है और कमेंट्स भी शानदार हैं आज",
        "सच में यह वाला सीन सबसे बेहतर था पूरे एपिसोड में",
      ])
    ).toBe(true);
  });

  it("does not flag ordinary English comments, including a short joke", () => {
    expect(
      commentsLookNonEnglish([
        "this is the one I keep coming back to every single time",
        "you can hear the room change the second the chorus hits",
        "nah",
      ])
    ).toBe(false);
    expect(needsTranslation({ title: "Grand Theft Auto VI Launch Trailer", englishRatio: 0.9 })).toBe(false);
  });

  it("flags long comments with no English function words", () => {
    const roman = [
      "mitti de baway wala scene ajj bohat emotional si te har koi ro raha",
      "green tv ne is episode vich jo kaha oh sach si bilkul har lafz te",
      "menu lagda ay ke agli episode vich yeh wala character wapas aaye ga",
    ];
    expect(commentsLookNonEnglish(roman)).toBe(true);
    expect(needsTranslation({ title: "295 (MUSIC VIDEO) SIDHU MOOSE WALA", commentTexts: roman })).toBe(true);
  });

  it("builds a Google Translate link for our page", () => {
    expect(googleTranslatePageUrl("https://paiddev.com/comments/v/dgV7wo5hcqE")).toBe(
      "https://translate.google.com/translate?sl=auto&tl=en&u=" +
        encodeURIComponent("https://paiddev.com/comments/v/dgV7wo5hcqE")
    );
  });
});
