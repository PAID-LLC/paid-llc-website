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
