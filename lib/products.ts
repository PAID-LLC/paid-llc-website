// ── Digital product catalog ────────────────────────────────────────────────────
// Single source of truth for product slugs, display titles, and filenames.
// Used by the download page and the Stripe webhook.

export const productTitles: Record<string, string> = {
  "ai-readiness-assessment":         "AI Readiness Assessment",
  "microsoft-365-copilot-playbook":  "Microsoft 365 Copilot Playbook",
  "excel-ai-data-analysis":          "Excel + AI: Analyze Data Without a Data Analyst",
  "ai-powered-outlook":              "AI-Powered Outlook: Smart Email System",
  "google-workspace-ai-guide":       "Google Workspace AI Guide",
  "gmail-ai-inbox-zero":             "Gmail + AI: Inbox Zero for Business",
  "solopreneur-content-engine":      "The Solopreneur Content Engine",
  "small-business-ai-operations":    "Small Business AI Operations Playbook",
  "chatgpt-business-prompt-library": "ChatGPT Business Prompt Library",
  "all-guides-bundle":               "All Guides Bundle",
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
  { id: "ai-readiness-assessment",         name: "AI Readiness Assessment",                              price: 14.99, category: "Business",   description: "Benchmark where your business stands on AI adoption, identify your highest-value gaps, and walk away with a prioritized action plan." },
  { id: "microsoft-365-copilot-playbook",  name: "Microsoft 365 Copilot Playbook",                       price: 19.99, category: "Microsoft",  description: "Practical Copilot workflows for Word, Excel, Outlook, and Teams. Real examples your team can implement on day one." },
  { id: "excel-ai-data-analysis",          name: "Excel + AI: Analyze Data Without a Data Analyst",      price: 14.99, category: "Microsoft",  description: "Use ChatGPT and Copilot to clean, analyze, and summarize spreadsheet data — no advanced formulas or data background required." },
  { id: "ai-powered-outlook",              name: "AI-Powered Outlook: Smart Email System",                price:  9.99, category: "Microsoft",  description: "Build a zero-inbox system using AI-generated templates, smart filters, and automated follow-up workflows inside Outlook." },
  { id: "google-workspace-ai-guide",       name: "Google Workspace AI Guide",                            price: 19.99, category: "Google",     description: "Put Gemini to work across Gmail, Docs, Sheets, and Meet. Includes copy-paste workflows, prompts, and time-saving shortcuts." },
  { id: "gmail-ai-inbox-zero",             name: "Gmail + AI: Inbox Zero for Business",                  price:  9.99, category: "Google",     description: "A practical system for managing high-volume email using AI drafts, label automation, and reusable template libraries." },
  { id: "solopreneur-content-engine",      name: "The Solopreneur Content Engine",                       price: 19.99, category: "Business",   description: "Automate your blog and social media content using Claude or ChatGPT plus Zapier. Includes prompt templates and workflow blueprints." },
  { id: "small-business-ai-operations",    name: "Small Business AI Operations Playbook",                 price: 24.99, category: "Business",   description: "Audit your business for AI opportunities, then automate three core workflows: customer communication, scheduling, and reporting." },
  { id: "chatgpt-business-prompt-library", name: "ChatGPT Business Prompt Library",                      price: 12.99, category: "Business",   description: "100+ copy-paste prompts for sales, marketing, operations, HR, and customer service — organized by function and ready to use." },
];

/** Maps product slugs to their filenames in Supabase Storage → guides bucket. */
export const slugToFile: Record<string, string> = {
  "ai-readiness-assessment":         "ai-readiness-assessment.pdf",
  "microsoft-365-copilot-playbook":  "microsoft-365-copilot-playbook.pdf",
  "excel-ai-data-analysis":          "excel-ai-data-analysis.pdf",
  "ai-powered-outlook":              "ai-powered-outlook.pdf",
  "google-workspace-ai-guide":       "google-workspace-ai-guide.pdf",
  "gmail-ai-inbox-zero":             "gmail-ai-inbox-zero.pdf",
  "solopreneur-content-engine":      "solopreneur-content-engine.pdf",
  "small-business-ai-operations":    "small-business-ai-operations.pdf",
  "chatgpt-business-prompt-library": "chatgpt-business-prompt-library.pdf",
  "all-guides-bundle":               "all-guide-bundles.zip",
};
