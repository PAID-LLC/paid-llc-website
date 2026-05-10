// One-time script: create Stripe Products + Prices + Payment Links for all guides.
// This replaces inline price_data links with proper catalog-backed links.
// Run from website root: node scripts/sync-stripe-catalog.js
//
// What it does:
//   1. Creates a Stripe Product (with description + metadata) for each item
//   2. Creates a one-time Price attached to that product
//   3. Creates a new Payment Link using the price ID
//   4. Deactivates old payment links that share the same metadata[product] slug
//   5. Saves new URLs to scripts/stripe-catalog-output.txt

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

// ── Full catalog ───────────────────────────────────────────────────────────────
const CATALOG = [
  {
    slug: "ai-readiness-assessment",
    name: "AI Readiness Assessment",
    description: "Benchmark where your business stands on AI adoption, identify your highest-value gaps, and walk away with a prioritized action plan. PDF guide, instant download.",
    price_cents: 1499,
  },
  {
    slug: "microsoft-365-copilot-playbook",
    name: "Microsoft 365 Copilot Playbook",
    description: "Practical Copilot workflows for Word, Excel, Outlook, and Teams. Real examples your team can implement on day one. PDF guide, instant download.",
    price_cents: 1999,
  },
  {
    slug: "excel-ai-data-analysis",
    name: "Excel + AI: Analyze Data Without a Data Analyst",
    description: "Use ChatGPT and Copilot to clean, analyze, and summarize spreadsheet data -- no advanced formulas or data background required. PDF guide, instant download.",
    price_cents: 1499,
  },
  {
    slug: "ai-powered-outlook",
    name: "AI-Powered Outlook: Smart Email System",
    description: "Build a zero-inbox system using AI-generated templates, smart filters, and automated follow-up workflows inside Outlook. PDF guide, instant download.",
    price_cents: 999,
  },
  {
    slug: "google-workspace-ai-guide",
    name: "Google Workspace AI Guide",
    description: "Put Gemini to work across Gmail, Docs, Sheets, and Meet. Includes copy-paste workflows, prompts, and time-saving shortcuts. PDF guide, instant download.",
    price_cents: 1999,
  },
  {
    slug: "gmail-ai-inbox-zero",
    name: "Gmail + AI: Inbox Zero for Business",
    description: "A practical system for managing high-volume email using AI drafts, label automation, and reusable template libraries. PDF guide, instant download.",
    price_cents: 999,
  },
  {
    slug: "solopreneur-content-engine",
    name: "The Solopreneur Content Engine",
    description: "Automate your blog and social media content using Claude or ChatGPT plus Zapier. Includes prompt templates and workflow blueprints. PDF guide, instant download.",
    price_cents: 1999,
  },
  {
    slug: "small-business-ai-operations",
    name: "Small Business AI Operations Playbook",
    description: "Audit your business for AI opportunities, then automate three core workflows: customer communication, scheduling, and reporting. PDF guide, instant download.",
    price_cents: 2499,
  },
  {
    slug: "chatgpt-business-prompt-library",
    name: "ChatGPT Business Prompt Library",
    description: "100+ copy-paste prompts for sales, marketing, operations, HR, and customer service -- organized by function and ready to use. PDF guide, instant download.",
    price_cents: 1299,
  },
  {
    slug: "claude-for-business-practical-playbook",
    name: "Claude for Business: The Practical Playbook",
    description: "Real workflows for using Claude in business: document analysis, proposal writing, client communications, and building a persistent AI assistant that knows your business. PDF guide, instant download.",
    price_cents: 1999,
  },
  {
    slug: "ai-agents-for-small-business",
    name: "AI Agents for Small Business",
    description: "Plain-English guide to deploying your first AI agent -- lead follow-up, proposal generation, triage, and automation -- in 30 days with no code required. PDF guide, instant download.",
    price_cents: 1999,
  },
  {
    slug: "cursor-ai-coding-guide",
    name: "Build It Without Code: A Non-Developer's Guide to Cursor",
    description: "Use Cursor and AI to build landing pages, internal tools, intake forms, and data dashboards -- without hiring a developer or learning to code. PDF guide, instant download.",
    price_cents: 1999,
  },
  {
    slug: "copilot-cowork-microsoft-365-team-guide",
    name: "Copilot as a Coworker: The Microsoft 365 Team Collaboration Guide",
    description: "Team-level Copilot deployment for Microsoft 365: meeting recaps, collaborative documents, Copilot Pages, and shared prompt libraries that make AI consistent across your whole team. PDF guide, instant download.",
    price_cents: 1999,
  },
  {
    slug: "free-ai-stack-small-business-setup",
    name: "The Free AI Stack: An End-to-End AI Setup for Small Business",
    description: "Build a complete five-tool AI stack -- writing, visuals, automation, inbox, and organization -- for $0 using Claude, Gemini, Canva, Zapier, and Notion free tiers. PDF guide, instant download.",
    price_cents: 1499,
  },
  {
    slug: "jumpstart-business-ai-under-100",
    name: "Jumpstart Your Business with AI for Under $100 a Month",
    description: "Concentrate your AI budget into two or three tools that cover 90% of small business needs. Claude Pro, Zapier Starter, and one specialized tool -- wired together and producing ROI in week one. PDF guide, instant download.",
    price_cents: 1499,
  },
  {
    slug: "enterprise-ai-deployment-guide",
    name: "Enterprise AI Deployment: The Complete Implementation Guide",
    description: "An 8-phase enterprise AI deployment framework covering use case selection, vendor evaluation, security and compliance, pilot design, change management, phased rollout, and ROI measurement. PDF guide, instant download.",
    price_cents: 2999,
  },
  {
    slug: "all-guides-bundle",
    name: "All Guides Bundle -- 16 Guides",
    description: "All 16 PAID LLC AI guides in one bundle. Covers free-tier setup, Microsoft 365, Google Workspace, content marketing, operations, and enterprise deployment. ZIP archive, instant download.",
    price_cents: 11900,
  },
  {
    slug: "founding-member",
    name: "Founding Member -- All 16 Guides + 12 Months of New Releases + 1 Custom Guide",
    description: "All 16 current guides, every guide PAID LLC publishes for the next 12 months automatically delivered, plus one custom guide on a topic of your choice. Email hello@paiddev.com after purchase to request your custom guide.",
    price_cents: 19900,
  },
];

// ── Stripe helpers ─────────────────────────────────────────────────────────────
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

async function stripePost(endpoint, params) {
  const body = new URLSearchParams(flatten(params)).toString();
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `${res.status}`);
  return data;
}

async function stripeGet(endpoint) {
  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? `${res.status}`);
  return data;
}

// ── Fetch all active payment links ─────────────────────────────────────────────
async function getActivePaymentLinks() {
  const links = [];
  let url = "payment_links?limit=100&active=true";
  while (url) {
    const page = await stripeGet(url);
    links.push(...page.data);
    url = page.has_more ? `payment_links?limit=100&active=true&starting_after=${page.data.at(-1).id}` : null;
  }
  return links;
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log("\nFetching existing active payment links...");
const existingLinks = await getActivePaymentLinks();
console.log(`  Found ${existingLinks.length} active payment links\n`);

// Build slug → old link ID map from existing links with matching metadata
const oldLinkIds = {};
for (const link of existingLinks) {
  const slug = link.metadata?.product;
  if (slug) oldLinkIds[slug] = link.id;
}

console.log(`Creating ${CATALOG.length} products, prices, and payment links...\n`);

const results = [];

for (const item of CATALOG) {
  try {
    // 1. Create Product
    const product = await stripePost("products", {
      name: item.name,
      description: item.description,
      metadata: { product: item.slug },
    });

    // 2. Create Price
    const price = await stripePost("prices", {
      product: product.id,
      unit_amount: item.price_cents,
      currency: "usd",
    });

    // 3. Create Payment Link
    const redirectUrl = `${SITE_URL}/download/${item.slug}?session_id={CHECKOUT_SESSION_ID}`;
    const link = await stripePost("payment_links", {
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": 1,
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": redirectUrl,
      "metadata[product]": item.slug,
    });

    results.push({ slug: item.slug, price: `$${(item.price_cents / 100).toFixed(2)}`, url: link.url, productId: product.id, priceId: price.id });
    console.log(`  OK   ${item.slug}`);
    console.log(`       product=${product.id}  price=${price.id}`);
    console.log(`       ${link.url}\n`);

  } catch (err) {
    results.push({ slug: item.slug, price: "ERROR", url: String(err.message), productId: null, priceId: null });
    console.error(`  FAIL ${item.slug}: ${err.message}\n`);
  }
}

// ── Deactivate old links for successfully migrated slugs ───────────────────────
console.log("\nDeactivating old payment links...\n");
const migrated = new Set(results.filter(r => r.url.startsWith("http")).map(r => r.slug));

for (const [slug, oldId] of Object.entries(oldLinkIds)) {
  if (!migrated.has(slug)) continue;
  try {
    await stripePost(`payment_links/${oldId}`, { active: "false" });
    console.log(`  Deactivated ${oldId} (${slug})`);
  } catch (err) {
    console.warn(`  Could not deactivate ${oldId} (${slug}): ${err.message}`);
  }
}

// ── Output ─────────────────────────────────────────────────────────────────────
const outputLines = results.map(r => `${r.slug} | ${r.price} | ${r.url}`);
const outputPath = path.join(__dirname, "stripe-catalog-output.txt");
fs.writeFileSync(outputPath, outputLines.join("\n") + "\n");

console.log("\n\n=== NEW PAYMENT LINKS (paste to Claude Cowork) ===\n");
for (const line of outputLines) console.log(line);
console.log("\n===================================================\n");
console.log(`Results saved to: scripts/stripe-catalog-output.txt\n`);
