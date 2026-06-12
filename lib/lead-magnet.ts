// ── Lead magnet content: The AI Quick-Wins Checklist ─────────────────────────
// Single source of truth — rendered on /free/ai-quick-wins and sent in the
// delivery email by /api/lead-magnet. Keep the two in sync by editing here.

export const LEAD_MAGNET = {
  slug:     "ai-quick-wins",
  title:    "The AI Quick-Wins Checklist",
  subtitle: "10 things a small business can automate this week, using tools you already pay for.",
};

export interface QuickWin {
  title: string;
  how:   string;
  tool:  string;
}

export const QUICK_WINS: QuickWin[] = [
  {
    title: "Let AI draft your email replies",
    how:   "Open your three most repetitive email threads. Ask AI to draft replies in your voice, then edit and send. Most owners save 30 to 60 minutes a day on this alone.",
    tool:  "Copilot in Outlook, Gemini in Gmail, or paste into Claude or ChatGPT",
  },
  {
    title: "Stop taking meeting notes by hand",
    how:   "Turn on AI recap for every meeting. You get a summary, decisions, and action items without typing a word. Review once, forward to attendees.",
    tool:  "Teams Premium recap, Google Meet 'take notes for me', or Otter free tier",
  },
  {
    title: "Build a standard-replies library from your sent folder",
    how:   "Give AI ten of your past sent emails and ask it to extract your five most common reply types as reusable templates. Save them as drafts or text shortcuts.",
    tool:  "Claude or ChatGPT, one 15-minute session",
  },
  {
    title: "First-draft proposals and quotes with AI",
    how:   "Paste your last winning proposal and the new client's details. Ask for a first draft in the same structure. You edit numbers and specifics, not blank pages.",
    tool:  "Claude (long documents) or ChatGPT",
  },
  {
    title: "Turn one piece of content into five",
    how:   "Take your newest blog post, case study, or FAQ answer. Ask AI for two LinkedIn posts, two X posts, and one email-newsletter blurb. Schedule them for the week.",
    tool:  "Any chat AI plus your social scheduler",
  },
  {
    title: "Answer customer questions before they ask",
    how:   "Collect your ten most-asked customer questions. Have AI write clean, friendly answers. Publish as an FAQ page and reuse them as canned replies.",
    tool:  "Claude or ChatGPT, then your website or help inbox",
  },
  {
    title: "Analyze your spreadsheet in plain English",
    how:   "Ask questions like 'which product had the best margin last quarter' directly against your data instead of writing formulas. Verify anything that drives a decision.",
    tool:  "Copilot in Excel, Gemini in Sheets, or upload a CSV to Claude or ChatGPT",
  },
  {
    title: "Summarize long documents before you read them",
    how:   "Contracts, reports, vendor agreements: get a one-page summary with key terms, dates, and obligations first, then read the sections that matter closely.",
    tool:  "Claude handles the longest documents on a free plan",
  },
  {
    title: "Run a weekly 15-minute competitive scan",
    how:   "Once a week, ask AI to search for news about your industry, your top competitors, and your customers' industries. Skim the summary with Friday coffee.",
    tool:  "ChatGPT with search, Gemini, or Perplexity",
  },
  {
    title: "Build a prompt library with your business context",
    how:   "Write one paragraph describing your business, customers, and voice. Save it. Start every AI session by pasting it first; the quality jump is immediate.",
    tool:  "A notes app is enough; Claude Projects or custom GPTs make it automatic",
  },
];

/** Plain-text version for the delivery email. */
export function checklistEmailText(): string {
  const items = QUICK_WINS.map((w, i) => [
    `${i + 1}. ${w.title}`,
    `   How: ${w.how}`,
    `   Tools: ${w.tool}`,
  ].join("\n")).join("\n\n");

  return [
    `${LEAD_MAGNET.title}`,
    `${LEAD_MAGNET.subtitle}`,
    ``,
    items,
    ``,
    `----`,
    ``,
    `Want these implemented for you instead of by you?`,
    `PAID LLC sets up AI workflows for small businesses: consulting,`,
    `implementation, and team training. Reply to this email or visit`,
    `https://paiddev.com/services to book a free discovery call.`,
    ``,
    `-- Travis Raveling`,
    `Founder, PAID LLC`,
    `https://paiddev.com`,
  ].join("\n");
}
