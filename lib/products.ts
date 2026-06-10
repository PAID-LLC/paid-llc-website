// ── Digital product catalog ────────────────────────────────────────────────────
// Single source of truth for product slugs, display titles, and filenames.
// Used by the download page and the Stripe webhook.

export const productTitles: Record<string, string> = {
  "crypto-payments-small-business":           "Accepting Crypto Payments: A Small Business Setup Guide",
  "ai-readiness-assessment":                  "AI Readiness Assessment",
  "microsoft-365-copilot-playbook":           "Microsoft 365 Copilot Playbook",
  "excel-ai-data-analysis":                   "Excel + AI: Analyze Data Without a Data Analyst",
  "ai-powered-outlook":                       "AI-Powered Outlook: Smart Email System",
  "google-workspace-ai-guide":                "Google Workspace AI Guide",
  "gmail-ai-inbox-zero":                      "Gmail + AI: Inbox Zero for Business",
  "solopreneur-content-engine":               "The Solopreneur Content Engine",
  "small-business-ai-operations":             "Small Business AI Operations Playbook",
  "chatgpt-business-prompt-library":          "ChatGPT Business Prompt Library",
  "claude-for-business-practical-playbook":   "Claude for Business: The Practical Playbook",
  "ai-agents-for-small-business":             "AI Agents for Small Business",
  "cursor-ai-coding-guide":                   "Build It Without Code: A Non-Developer's Guide to Cursor",
  "copilot-cowork-microsoft-365-team-guide":  "Copilot as a Coworker: The Microsoft 365 Team Collaboration Guide",
  "free-ai-stack-small-business-setup":       "The Free AI Stack: An End-to-End AI Setup for Small Business",
  "jumpstart-business-ai-under-100":          "Jumpstart Your Business with AI for Under $100 a Month",
  "enterprise-ai-deployment-guide":           "Enterprise AI Deployment: The Complete Implementation Guide",
  "all-guides-bundle":                        "All Guides Bundle -- 17 Guides",
  "founding-member":                          "Founding Member -- All 17 Guides + 12 Months of New Releases",
  "context-capsule":                          "The Context Capsule",
  "context-capsule-solo":                     "The Context Capsule -- Solo License",
  "context-capsule-team":                     "The Context Capsule -- Team License",
  "context-capsule-enterprise":               "The Context Capsule -- Enterprise License",
  "latent-signature":                         "The Latent Signature",
  "protocol-patch":                           "The Protocol Patch",
};

export interface Product {
  id:          string;
  name:        string;
  description: string;
  price:       number;
  category:    string;
}

/** Structured product catalog — used by MCP tools and UCP discovery. */
export const PRODUCTS: Product[] = [
  { id: "crypto-payments-small-business",           name: "Accepting Crypto Payments: A Small Business Setup Guide",        price: 14.99, category: "Getting Started",        description: "Step-by-step guide to accepting USDC and stablecoin payments without holding volatile assets. Covers Coinbase Commerce setup, payment links, tax treatment, refund policy, and invoice integration." },
  { id: "ai-readiness-assessment",                 name: "AI Readiness Assessment",                                           price: 14.99, category: "Getting Started",        description: "Benchmark where your business stands on AI adoption, identify your highest-value gaps, and walk away with a prioritized action plan." },
  { id: "free-ai-stack-small-business-setup",      name: "The Free AI Stack: An End-to-End AI Setup for Small Business",    price: 14.99, category: "Getting Started",        description: "Build a complete five-tool AI stack -- writing, visuals, automation, inbox, and organization -- for $0 using Claude, Gemini, Canva, Zapier, and Notion free tiers." },
  { id: "jumpstart-business-ai-under-100",         name: "Jumpstart Your Business with AI for Under $100 a Month",          price: 14.99, category: "Getting Started",        description: "Concentrate your AI budget into two or three tools that cover 90% of small business needs. Claude Pro, Zapier Starter, and one specialized tool -- wired together and producing ROI in week one." },
  { id: "microsoft-365-copilot-playbook",          name: "Microsoft 365 Copilot Playbook",                                    price: 19.99, category: "Microsoft 365",         description: "Practical Copilot workflows for Word, Excel, Outlook, and Teams. Real examples your team can implement on day one." },
  { id: "excel-ai-data-analysis",                  name: "Excel + AI: Analyze Data Without a Data Analyst",                   price: 14.99, category: "Microsoft 365",         description: "Use ChatGPT and Copilot to clean, analyze, and summarize spreadsheet data -- no advanced formulas or data background required." },
  { id: "ai-powered-outlook",                      name: "AI-Powered Outlook: Smart Email System",                            price:  9.99, category: "Microsoft 365",         description: "Build a zero-inbox system using AI-generated templates, smart filters, and automated follow-up workflows inside Outlook." },
  { id: "copilot-cowork-microsoft-365-team-guide", name: "Copilot as a Coworker: The Microsoft 365 Team Collaboration Guide", price: 19.99, category: "Microsoft 365",         description: "Team-level Copilot deployment for Microsoft 365: meeting recaps, collaborative documents, Copilot Pages, and shared prompt libraries that make AI output consistent across your whole team." },
  { id: "google-workspace-ai-guide",               name: "Google Workspace AI Guide",                                         price: 19.99, category: "Google Workspace",      description: "Put Gemini to work across Gmail, Docs, Sheets, and Meet. Includes copy-paste workflows, prompts, and time-saving shortcuts." },
  { id: "gmail-ai-inbox-zero",                     name: "Gmail + AI: Inbox Zero for Business",                               price:  9.99, category: "Google Workspace",      description: "A practical system for managing high-volume email using AI drafts, label automation, and reusable template libraries." },
  { id: "solopreneur-content-engine",              name: "The Solopreneur Content Engine",                                    price: 19.99, category: "Content & Marketing",    description: "Automate your blog and social media content using Claude or ChatGPT plus Zapier. Includes prompt templates and workflow blueprints." },
  { id: "chatgpt-business-prompt-library",         name: "ChatGPT Business Prompt Library",                                   price: 12.99, category: "Content & Marketing",    description: "100+ copy-paste prompts for sales, marketing, operations, HR, and customer service -- organized by function and ready to use." },
  { id: "small-business-ai-operations",            name: "Small Business AI Operations Playbook",                             price: 24.99, category: "Operations",             description: "Audit your business for AI opportunities, then automate three core workflows: customer communication, scheduling, and reporting." },
  { id: "claude-for-business-practical-playbook",  name: "Claude for Business: The Practical Playbook",                      price: 19.99, category: "Operations",             description: "Real workflows for using Claude in business: document analysis, proposal writing, client communications, and building a persistent AI assistant that knows your business." },
  { id: "ai-agents-for-small-business",            name: "AI Agents for Small Business",                                     price: 19.99, category: "Operations",             description: "Plain-English guide to deploying your first AI agent -- lead follow-up, proposal generation, triage, and automation -- in 30 days with no code required." },
  { id: "cursor-ai-coding-guide",                  name: "Build It Without Code: A Non-Developer's Guide to Cursor",         price: 19.99, category: "Operations",             description: "Use Cursor and AI to build landing pages, internal tools, intake forms, and data dashboards -- without hiring a developer or learning to code." },
  { id: "enterprise-ai-deployment-guide",          name: "Enterprise AI Deployment: The Complete Implementation Guide",     price: 29.99, category: "Enterprise",             description: "An 8-phase enterprise AI deployment framework covering use case selection, vendor evaluation, security and compliance, pilot design, change management, phased rollout, and ROI measurement." },
  { id: "all-guides-bundle", name: "All Guides Bundle -- 17 Guides",                                                            price: 119.00, category: "Bundle",   description: "All 17 PAID LLC AI guides in one bundle. Covers free-tier setup, Microsoft 365, Google Workspace, content marketing, operations, and enterprise deployment. ZIP archive, instant download." },
  { id: "founding-member",   name: "Founding Member -- All 17 Guides + 12 Months of New Releases + 1 Custom Guide",            price: 199.00, category: "Bundle",   description: "All 17 current guides, every new guide PAID LLC publishes for 12 months automatically delivered, plus one custom guide on a topic of your choice." },
];

// ── Latent Credit Packs ────────────────────────────────────────────────────────
// Prepaid credits for Arena actions. One credit = one Arena action.

export const CREDIT_PACKS = [
  { id: "credits-200",   label: "200 Latent Credits",   credits: 200,   price_cents: 200   },  // $2.00
  { id: "credits-700",   label: "700 Latent Credits",   credits: 700,   price_cents: 500   },  // $5.00
  { id: "credits-1500",  label: "1500 Latent Credits",  credits: 1500,  price_cents: 1000  },  // $10.00
  { id: "credits-3000",  label: "3000 Latent Credits",  credits: 3000,  price_cents: 2500  },  // $25.00
  { id: "credits-8000",  label: "8000 Latent Credits",  credits: 8000,  price_cents: 5000  },  // $50.00
  { id: "credits-20000", label: "20000 Latent Credits", credits: 20000, price_cents: 10000 },  // $100.00
] as const;
export type CreditPackId = typeof CREDIT_PACKS[number]["id"];

/** Stripe payment link URLs — single source of truth for checkout links. */
export const productStripeUrls: Record<string, string> = {
  "crypto-payments-small-business":          "https://buy.stripe.com/bJe9AUb2T00qgiy3aUcs80K",
  "ai-readiness-assessment":                 "https://buy.stripe.com/00wfZidb1cNc4zQ26Qcs80s",
  "free-ai-stack-small-business-setup":      "https://buy.stripe.com/00w6oIdb14gG1nEh1Kcs80F",
  "jumpstart-business-ai-under-100":         "https://buy.stripe.com/9B64gAb2TaF46HY12Mcs80G",
  "microsoft-365-copilot-playbook":          "https://buy.stripe.com/6oU4gAef53cC3vM9zics80t",
  "excel-ai-data-analysis":                  "https://buy.stripe.com/9B628s3Ar28yd6m7racs80u",
  "ai-powered-outlook":                      "https://buy.stripe.com/eVq6oI0ofcNc2rI7racs80v",
  "copilot-cowork-microsoft-365-team-guide": "https://buy.stripe.com/fZucN6b2T7sS2rIbHqcs80E",
  "google-workspace-ai-guide":               "https://buy.stripe.com/7sYeVeb2T9B00jAdPycs80w",
  "gmail-ai-inbox-zero":                     "https://buy.stripe.com/7sYaEY9YP4gG8Q6cLucs80x",
  "solopreneur-content-engine":              "https://buy.stripe.com/7sY4gA5Iz00q3vMcLucs80y",
  "chatgpt-business-prompt-library":         "https://buy.stripe.com/6oU8wQdb1bJ87M25j2cs80A",
  "small-business-ai-operations":            "https://buy.stripe.com/dRmbJ27QHcNceaq9zics80z",
  "claude-for-business-practical-playbook":  "https://buy.stripe.com/7sY8wQ4EvbJ85DU7racs80B",
  "ai-agents-for-small-business":            "https://buy.stripe.com/7sY28sef56oO4zQ4eYcs80C",
  "cursor-ai-coding-guide":                  "https://buy.stripe.com/00wfZi4EveVkfeu5j2cs80D",
  "enterprise-ai-deployment-guide":          "https://buy.stripe.com/dRmdRa2wn8wW6HY3aUcs80H",
  "all-guides-bundle":                       "https://buy.stripe.com/00w4gA8UL28y6HY5j2cs80I",
  "founding-member":                         "https://buy.stripe.com/7sYeVe4Ev28ygiy9zics80J",
};

/** Maps product slugs to their filenames in Supabase Storage → guides bucket. */
export const slugToFile: Record<string, string> = {
  "crypto-payments-small-business":           "crypto-payments-small-business-guide.pdf",
  "ai-readiness-assessment":                  "ai-readiness-assessment.pdf",
  "microsoft-365-copilot-playbook":           "microsoft-365-copilot-playbook.pdf",
  "excel-ai-data-analysis":                   "excel-ai-data-analysis.pdf",
  "ai-powered-outlook":                       "ai-powered-outlook.pdf",
  "google-workspace-ai-guide":                "google-workspace-ai-guide.pdf",
  "gmail-ai-inbox-zero":                      "gmail-ai-inbox-zero.pdf",
  "solopreneur-content-engine":               "solopreneur-content-engine.pdf",
  "small-business-ai-operations":             "small-business-ai-operations.pdf",
  "chatgpt-business-prompt-library":          "chatgpt-business-prompt-library.pdf",
  "claude-for-business-practical-playbook":   "claude-for-business-practical-playbook.pdf",
  "ai-agents-for-small-business":             "ai-agents-for-small-business.pdf",
  "cursor-ai-coding-guide":                   "cursor-ai-coding-guide.pdf",
  "copilot-cowork-microsoft-365-team-guide":  "copilot-cowork-microsoft-365-team-guide.pdf",
  "free-ai-stack-small-business-setup":       "free-ai-stack-small-business-setup.pdf",
  "jumpstart-business-ai-under-100":          "jumpstart-business-ai-under-100.pdf",
  "enterprise-ai-deployment-guide":           "enterprise-ai-deployment-guide.pdf",
  "all-guides-bundle":                        "all-guide-bundles.zip",
  "founding-member":                          "all-guide-bundles.zip",
  "context-capsule":                          "context-capsule.md",
  "context-capsule-solo":                     "context-capsule.md",
  "context-capsule-team":                     "context-capsule.md",
  "context-capsule-enterprise":               "context-capsule.md",
  "latent-signature":                         "latent-signature.svg",
  "protocol-patch":                           "protocol-patch.json",
};
