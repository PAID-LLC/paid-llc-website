/**
 * Renders the site's static Open Graph cards to public/.
 *
 *   node scripts/make-og-cards.mjs
 *
 * Run this once, commit the PNGs, and forget it exists until the branding
 * changes. It is not part of the build: OG cards are static assets, and adding
 * a headless-Chrome launch to every deploy to regenerate two unchanging images
 * would be a poor trade against the Cloudflare build minutes.
 *
 * WHY NOT next/og. ImageResponse pulls satori plus a resvg WASM binary into the
 * Worker bundle, which sits near Cloudflare's 10 MiB cap. Megabytes of runtime
 * for an image that never changes is the wrong shape; a PNG in public/ costs
 * nothing at runtime.
 *
 * Puppeteer is borrowed from the Executive Assistant repo's guide-formatter
 * skill rather than added as a dependency here, for the same bundle reason.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// puppeteer-core, not puppeteer: the skill ships the driver without a bundled
// browser, so an executablePath has to be supplied. The download cache is the
// first candidate; a locally installed Chrome is the fallback.
const PUPPETEER_PATH = path.join(
  ROOT,
  "../Executive Assistant Claude Cowork/.claude/skills/guide-formatter/node_modules/puppeteer-core"
);

const CHROME_CANDIDATES = [
  path.join(process.env.USERPROFILE ?? process.env.HOME ?? "", ".cache/puppeteer/chrome/win64-131.0.6778.204/chrome-win64/chrome.exe"),
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (c && fs.existsSync(c)) return c;
  return null;
}

// ── The cards ────────────────────────────────────────────────────────────────
// Palette and type are the v2 system: near-black ground, terracotta lead, cyan
// partner, mono headings. Kept in sync with components/v2/tokens.ts by hand,
// which is acceptable for two files that change once a year.

const SHELL = (body) => `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: #07070b; color: #e4e4e7;
    font-family: Montserrat, system-ui, sans-serif; position: relative; overflow: hidden;
  }
  /* The same 48px hairline grid the site's backdrop uses. */
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .glow {
    position: absolute; top: -200px; right: -160px; width: 720px; height: 720px;
    background: radial-gradient(circle, rgba(34,211,238,0.10), transparent 62%);
  }
  .glow2 {
    position: absolute; bottom: -260px; left: -180px; width: 640px; height: 640px;
    background: radial-gradient(circle, rgba(193,72,38,0.12), transparent 62%);
  }
  .inner { position: relative; padding: 72px 80px; height: 100%; display: flex; flex-direction: column; }
  .kicker {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; color: #E8714C;
  }
  .rule { height: 2px; width: 180px; margin: 26px 0 0;
          background: linear-gradient(90deg, #C14826, rgba(255,255,255,0.08)); }
  h1 { font-size: 82px; line-height: 1.02; letter-spacing: -0.02em; color: #fafafa; margin-top: 34px; font-weight: 700; }
  .cy { color: #22d3ee; }
  .sub { margin-top: 26px; font-size: 27px; line-height: 1.45; color: #a1a1aa; max-width: 880px; }
  .foot { margin-top: auto; display: flex; align-items: center; justify-content: space-between;
          font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 19px; color: #71717a; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 40px; height: 40px; border-radius: 9px; background: #C14826;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; color: #fff; font-size: 22px; font-family: Montserrat, sans-serif; }
  .chips { display: flex; gap: 12px; }
  .chip { border: 1px solid rgba(255,255,255,0.12); border-radius: 999px;
          padding: 7px 16px; font-size: 16px; color: #a1a1aa;
          font-family: "JetBrains Mono", ui-monospace, monospace; }
</style></head>
<body><div class="grid"></div><div class="glow"></div><div class="glow2"></div>
<div class="inner">${body}</div></body></html>`;

const CARDS = [
  {
    file: "public/og/comments.png",
    html: SHELL(`
      <p class="kicker">Daily · paiddev.com</p>
      <div class="rule"></div>
      <h1>The <span class="cy">Comment</span><br>Section</h1>
      <p class="sub">The most-watched videos in the United States, read through their
      comment sections. Sentiment, bot estimates, and the funniest comment nobody liked.</p>
      <div class="foot">
        <div class="brand"><div class="logo">P</div><span>paiddev.com/comments</span></div>
        <div class="chips"><span class="chip">new every morning</span></div>
      </div>`),
  },
  {
    // Referenced by app/blog/page.tsx and app/blog/[slug]/page.tsx since those
    // pages shipped, and 404ing the whole time. Same asset job, so it closes here.
    file: "public/og-default.png",
    html: SHELL(`
      <p class="kicker">paiddev.com</p>
      <div class="rule"></div>
      <h1>Infrastructure for<br>the <span class="cy">agentic era</span></h1>
      <p class="sub">AI consulting, implementation and agent-native software,
      built by PAID LLC.</p>
      <div class="foot">
        <div class="brand"><div class="logo">P</div><span>paiddev.com</span></div>
        <div class="chips"><span class="chip">PAID LLC</span></div>
      </div>`),
  },
];

async function main() {
  if (!fs.existsSync(PUPPETEER_PATH)) {
    console.error(`Puppeteer not found at:\n  ${PUPPETEER_PATH}`);
    console.error("It ships with the Executive Assistant repo's guide-formatter skill.");
    process.exit(1);
  }

  // Node 24 ignores module.globalPaths, so the package is required by explicit path.
  const require = createRequire(import.meta.url);
  const puppeteer = require(PUPPETEER_PATH);

  const executablePath = findChrome();
  if (!executablePath) {
    console.error("No Chrome binary found. Tried: " + CHROME_CANDIDATES.join(", "));
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });

  for (const card of CARDS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });

    const tmp = path.join(ROOT, ".og-tmp.html");
    fs.writeFileSync(tmp, card.html, "utf8");
    await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle0" });
    // Give the webfonts a beat; a card rendered in fallback type looks wrong.
    await new Promise((r) => setTimeout(r, 1200));

    const out = path.join(ROOT, card.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: "png" });
    fs.unlinkSync(tmp);
    await page.close();

    console.log(`${card.file}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }

  await browser.close();
  console.log("Done. Commit the PNGs; this script does not run at build time.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
