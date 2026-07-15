// Weekly fraud watch: scans recent Stripe charges for card-testing activity
// (many distinct names/emails, small amounts, high block/decline rate) and
// flags if volume is escalating. Read-only — never blocks or changes anything.
// Run from website root: node scripts/check-card-testing.js [days]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, "../.env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY in .env.local");
  process.exit(1);
}

const days = parseInt(process.argv[2] ?? "7", 10);
const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

// Thresholds — tuned to current baseline (~40 blocked attempts/day during the
// 2026-06-26 incident). Escalation here means "tell Travis", not "take action".
const DAILY_BLOCKED_WARN = 150;   // ~4x the observed baseline
const SUCCESS_RATE_WARN  = 0.5;   // a carding bot finding live cards would spike this

async function fetchAllCharges() {
  const charges = [];
  let startingAfter = "";
  for (let page = 0; page < 10; page++) {
    const url = new URL("https://api.stripe.com/v1/charges");
    url.searchParams.set("limit", "100");
    url.searchParams.set("created[gte]", String(since));
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } });
    const data = await res.json();
    if (data.error) { console.error("Stripe error:", data.error.message); process.exit(1); }
    charges.push(...data.data);
    if (!data.has_more || data.data.length === 0) break;
    startingAfter = data.data[data.data.length - 1].id;
  }
  return charges;
}

const charges = await fetchAllCharges();
const total = charges.length;
const succeeded = charges.filter((c) => c.status === "succeeded");
const blocked = charges.filter((c) => c.outcome?.type === "blocked");
const failed = charges.filter((c) => c.status === "failed");

const uniqueEmails = new Set(charges.map((c) => c.billing_details?.email).filter(Boolean));
const blockedPerDay = blocked.length / days;

console.log(`── Card testing watch — last ${days}d ──`);
console.log(`total charge attempts: ${total}`);
console.log(`succeeded:             ${succeeded.length}`);
console.log(`failed:                ${failed.length}`);
console.log(`blocked by Radar:      ${blocked.length}  (${blockedPerDay.toFixed(1)}/day)`);
console.log(`unique billing emails: ${uniqueEmails.size}`);

let flagged = false;
if (blockedPerDay > DAILY_BLOCKED_WARN) {
  flagged = true;
  console.log(`\n⚠ WARN: blocked attempts averaging ${blockedPerDay.toFixed(1)}/day — well above baseline. Consider rotating the targeted Payment Link.`);
}
if (total > 0 && succeeded.length / total > SUCCESS_RATE_WARN && total > 10) {
  flagged = true;
  console.log(`\n⚠ WARN: success rate ${(100 * succeeded.length / total).toFixed(0)}% with ${total} attempts — unusual, review recent succeeded charges for fraud.`);
}
if (!flagged) {
  console.log("\nAll clear — no escalation beyond known baseline.");
}
