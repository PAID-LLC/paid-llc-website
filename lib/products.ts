// ── Digital product catalog ────────────────────────────────────────────────────
// Single source of truth for product slugs, display titles, and filenames.
// Used by the download page and the Stripe webhook.

export const productTitles: Record<string, string> = {
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
  "all-guides-bundle":                        "All Guides Bundle -- 16 Guides",
  "founding-member":                          "Founding Member -- All 16 Guides + 12 Months of New Releases",
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

/** Maps product slugs to their filenames in Supabase Storage → guides bucket. */
export const slugToFile: Record<string, string> = {
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
