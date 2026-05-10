// Create Stripe Payment Links for all new guides + bundle + founding member
// Run from website root: node scripts/create-stripe-links.js
// Outputs a slug → URL table to paste back into Claude Cowork

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ────────────────────────────────────────────────────────────
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

const SITE_URL = "https://paiddev.com";

// ── Products to create ─────────────────────────────────────────────────────────
const PRODUCTS = [
  { slug: "claude-for-business-practical-playbook",   name: "Claude for Business: The Practical Playbook",                       price_cents: 1999  },
  { slug: "ai-agents-for-small-business",             name: "AI Agents for Small Business",                                      price_cents: 1999  },
  { slug: "cursor-ai-coding-guide",                   name: "Build It Without Code: A Non-Developer's Guide to Cursor",          price_cents: 1999  },
  { slug: "copilot-cowork-microsoft-365-team-guide",  name: "Copilot as a Coworker: The Microsoft 365 Team Collaboration Guide", price_cents: 1999  },
  { slug: "free-ai-stack-small-business-setup",       name: "The Free AI Stack: An End-to-End AI Setup for Small Business",      price_cents: 1499  },
  { slug: "jumpstart-business-ai-under-100",          name: "Jumpstart Your Business with AI for Under $100 a Month",            price_cents: 1499  },
  { slug: "enterprise-ai-deployment-guide",           name: "Enterprise AI Deployment: The Complete Implementation Guide",       price_cents: 2999  },
  { slug: "all-guides-bundle",                        name: "All Guides Bundle -- 16 Guides",                                    price_cents: 11900 },
  { slug: "founding-member",                          name: "Founding Member -- All 16 Guides + 12 Months of New Releases",      price_cents: 19900 },
];

// ── Stripe helpers ─────────────────────────────────────────────────────────────
function stripePost(endpoint, params) {
  // Stripe uses application/x-www-form-urlencoded with nested bracket notation
  function flatten(obj, prefix = "") {
    const pairs = [];
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        pairs.push(...flatten(v, key));
      } else {
        pairs.push([key, String(v)]);
      }
    }
    return pairs;
  }

  const body = new URLSearchParams(flatten(params)).toString();

  return fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
}

async function createPaymentLink(product) {
  const redirectUrl = `${SITE_URL}/download/${product.slug}?session_id={CHECKOUT_SESSION_ID}`;

  const res = await stripePost("payment_links", {
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": product.name,
    "line_items[0][price_data][unit_amount]": product.price_cents,
    "line_items[0][quantity]": 1,
    "after_completion[type]": "redirect",
    "after_completion[redirect][url]": redirectUrl,
    "metadata[product]": product.slug,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe error for ${product.slug}: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.url;
}

// ── Run ────────────────────────────────────────────────────────────────────────
console.log(`\nCreating ${PRODUCTS.length} Stripe payment links...\n`);

const results = [];
for (const product of PRODUCTS) {
  try {
    const url = await createPaymentLink(product);
    results.push({ slug: product.slug, price: `$${(product.price_cents / 100).toFixed(2)}`, url });
    console.log(`  OK  ${product.slug} -> ${url}`);
  } catch (err) {
    results.push({ slug: product.slug, price: "ERROR", url: String(err.message) });
    console.error(`  FAIL ${product.slug}: ${err.message}`);
  }
}

console.log("\n\n=== PASTE THIS BACK INTO CLAUDE COWORK ===\n");
for (const r of results) {
  console.log(`${r.slug} | ${r.price} | ${r.url}`);
}
console.log("\n==========================================\n");

// Also save to a file for easy copy-paste
const outputPath = path.join(__dirname, "stripe-links-output.txt");
fs.writeFileSync(outputPath, results.map(r => `${r.slug} | ${r.price} | ${r.url}`).join("\n") + "\n");
console.log(`Results also saved to: scripts/stripe-links-output.txt\n`);
