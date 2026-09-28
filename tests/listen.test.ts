import { describe, it, expect } from "vitest";
import {
  splitForSpeech,
  extractSpeechChunks,
  estimateListenMinutes,
  pickVoice,
  MAX_CHUNK_CHARS,
} from "@/lib/listen";

describe("splitForSpeech", () => {
  it("keeps short text as one chunk", () => {
    expect(splitForSpeech("  Hello   world. ")).toEqual(["Hello world."]);
  });

  it("returns nothing for empty text", () => {
    expect(splitForSpeech("   ")).toEqual([]);
  });

  it("splits long text on sentence boundaries under the limit", () => {
    const sentence = "This is a reasonably long sentence about Copilot. ";
    const chunks = splitForSpeech(sentence.repeat(20));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
      expect(c.endsWith(".")).toBe(true);
    }
  });

  it("breaks a single run-on sentence without losing words", () => {
    const words = Array.from({ length: 120 }, (_, i) => `word${i}`);
    const chunks = splitForSpeech(words.join(" "));
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 1);
    expect(chunks.join(" ").split(" ")).toEqual(words);
  });
});

describe("extractSpeechChunks", () => {
  const html = `
    <h2>Heading</h2>
    <p>First paragraph.</p>
    <ul><li>Plain item</li><li><p>Wrapped item</p></li></ul>
    <pre><code><p>code should be skipped</p></code></pre>
    <table><tr><th>Col</th></tr><tr><td>Cell</td></tr></table>
  `;

  it("reads title first, then blocks in document order, skipping code", () => {
    const root = document.createElement("div");
    root.innerHTML = html;
    const texts = extractSpeechChunks(root, "My Post").map((c) => c.text);
    expect(texts).toEqual([
      "My Post",
      "Heading",
      "First paragraph.",
      "Plain item",
      "Wrapped item",
      "Col",
      "Cell",
    ]);
  });

  it("links each chunk to its element for highlighting", () => {
    const root = document.createElement("div");
    root.innerHTML = html;
    const [title, heading] = extractSpeechChunks(root, "My Post");
    expect(title.el).toBeNull();
    expect(heading.el?.tagName).toBe("H2");
  });
});

describe("estimateListenMinutes", () => {
  it("never reports less than a minute", () => {
    expect(estimateListenMinutes([{ text: "hi", el: null }])).toBe(1);
  });

  it("scales with word count", () => {
    const text = Array(1650).fill("w").join(" ");
    expect(estimateListenMinutes([{ text, el: null }])).toBe(10);
  });
});

describe("pickVoice", () => {
  const v = (name: string, lang: string) =>
    ({ name, lang }) as SpeechSynthesisVoice;

  it("prefers natural English voices", () => {
    const voices = [v("Basic", "en-US"), v("Microsoft Aria Online (Natural)", "en-US")];
    expect(pickVoice(voices)?.name).toContain("Natural");
  });

  it("returns null with no English voice", () => {
    expect(pickVoice([v("Hans", "de-DE")])).toBeNull();
  });
});
