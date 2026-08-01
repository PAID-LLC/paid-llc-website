#!/usr/bin/env node
// ── Storefront integrity check ────────────────────────────────────────────────
// Verifies that a STRANGER COULD ACTUALLY BUY right now.
//
// Why this exists, and why /api/watchdog does not cover it:
// the watchdog checks Supabase reachability, webhook signature failures, and
// sales marked paid-but-undelivered. Every one of those is DOWNSTREAM of a sale
// already existing. If the buy button breaks, there are zero sales rows, zero
// webhook failures, and the watchdog reports {"ok":true,"status":"healthy"}.
//
// For a business with $9.99 in lifetime revenue that is the dangerous case:
// **a broken storefront and no demand produce byte-identical signals.** Silence
// is the expected state either way, so the failure can persist indefinitely.
//
// The payment links are parsed out of app/digital-products/page.tsx rather than
// duplicated here on purpose. A second hardcoded list would drift the first time
// a product is added, and a monitor that silently stops covering new products is
// worse than no monitor.
//
//   node scripts/check-storefront.mjs
//
// Exits non-zero on any failure. In CI that fails the workflow, and GitHub
// emails the repo owner, which is the same zero-secret alerting path watchdog.yml
// already relies on.

import { readFileSync } from "node:fs";

const ORIGIN = process.env.STOREFRONT_ORIGIN || "https://paiddev.com";
const SOURCE = "app/digital-products/page.tsx";
const TIMEOUT_MS = 20_000;

/** Pages a buyer has to get through. If any of these break, nobody can buy. */
const PAGES = [
  { path: "/digital-products", must: "buy.stripe.com" },
  { path: "/website-audit", must: null },
  { path: "/free/ai-quick-wins", must: null },
];

async function head(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // Stripe payment links reject HEAD on some edges, so use GET and discard.
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    const body = res.headers.get("content-type")?.includes("text/html")
      ? await res.text()
      : "";
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: "", error: e.name === "AbortError" ? "timeout" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

const failures = [];
let checked = 0;

// ── 1. Buyer-facing pages ─────────────────────────────────────────────────────
for (const page of PAGES) {
  const url = ORIGIN + page.path;
  const res = await head(url);
  checked++;
  if (!res.ok) {
    failures.push(`${page.path} returned ${res.status || res.error}`);
    continue;
  }
  if (page.must && !res.body.includes(page.must)) {
    // The page loads but no longer contains a purchase path. This is the
    // silent-breakage case: HTTP 200 with nothing to buy.
    failures.push(`${page.path} is 200 but contains no "${page.must}" — the buy path may have been removed`);
  }
}

// ── 2. Every Stripe payment link the storefront actually offers ───────────────
let links = [];
try {
  const src = readFileSync(SOURCE, "utf8");
  links = [...new Set(src.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) || [])];
} catch (e) {
  failures.push(`could not read ${SOURCE}: ${e.message}`);
}

if (links.length === 0) {
  // Not "nothing to check" — this means the storefront has no purchase links at
  // all, which is itself a total revenue outage.
  failures.push(`no Stripe payment links found in ${SOURCE} — the storefront has nothing to sell`);
} else {
  const results = await Promise.all(links.map(async (u) => ({ u, r: await head(u) })));
  for (const { u, r } of results) {
    checked++;
    // Stripe returns 404 for an archived or deleted payment link, which is the
    // most likely real-world break: a link deactivated in the dashboard while
    // the site keeps rendering it.
    if (!r.ok) failures.push(`payment link ${u.split("/").pop()} returned ${r.status || r.error}`);
  }
}

// ── report ────────────────────────────────────────────────────────────────────
const stamp = new Date().toISOString();
if (failures.length === 0) {
  console.log(`storefront OK  ${stamp}`);
  console.log(`  ${PAGES.length} buyer pages, ${links.length} payment links, ${checked} checks, 0 failures`);
  process.exit(0);
}

console.error(`STOREFRONT BROKEN  ${stamp}`);
console.error(`  ${failures.length} failure(s) across ${checked} checks:`);
for (const f of failures) console.error(`  - ${f}`);
console.error("");
console.error("A buyer cannot complete a purchase. This does not show up in");
console.error("/api/watchdog, because that only sees sales that already exist.");
process.exit(1);
