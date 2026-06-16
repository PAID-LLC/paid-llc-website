/**
 * Arti knowledge base -- local intent matching, no external API needed.
 * Add intents here as the site content grows.
 */

type Intent = {
  id: string;
  phrases: string[]; // multi-word matches (score 2 each)
  keywords: string[]; // single-word matches (score 1 each)
  response: string;
};

const INTENTS: Intent[] = [
  {
    id: "greeting",
    phrases: ["good morning", "good afternoon", "good evening"],
    keywords: ["hi", "hello", "hey", "howdy"],
    response:
      "Hi! I'm Arti, the PAID LLC assistant. I can answer questions about our services, digital guides, pricing, or how to get started. What would you like to know?",
  },
  {
    id: "what_is_paid",
    phrases: [
      "what is paid",
      "who is paid",
      "what do you do",
      "about paid",
      "tell me about",
      "what does paid",
    ],
    keywords: ["about", "company", "mission", "overview", "paid llc"],
    response:
      "PAID LLC (Performance Artificial Intelligence Development) helps businesses understand, deploy, and maximize AI. We offer AI strategy consulting, implementation advisory, team training, and a library of practical AI guides.",
  },
  {
    id: "services",
    phrases: [
      "what services",
      "what do you offer",
      "how can you help",
      "what can you do",
      "your services",
    ],
    keywords: ["services", "offer", "offerings"],
    response:
      "We offer four services: AI Strategy Consulting, AI Implementation Advisory, AI Team Training, and Web & Application Development. Visit paiddev.com/services for full details on each.",
  },
  {
    id: "consulting",
    phrases: [
      "ai strategy",
      "strategy consulting",
      "ai roadmap",
      "ai assessment",
      "ai audit",
    ],
    keywords: ["consulting", "strategy", "roadmap", "audit", "opportunities"],
    response:
      "AI Strategy Consulting starts at $1,500. We identify your highest-ROI AI opportunities and build a clear implementation roadmap. Visit paiddev.com/services#consulting to learn more.",
  },
  {
    id: "implementation",
    phrases: [
      "ai implementation",
      "implement ai",
      "deploy ai",
      "implementation advisory",
    ],
    keywords: ["implementation", "implement", "deploy", "deployment", "configure"],
    response:
      "AI Implementation Advisory starts at $5,000. We work alongside your IT team to configure AI tools, build workflows, and get solutions deployed correctly. Visit paiddev.com/services#implementation for details.",
  },
  {
    id: "training",
    phrases: [
      "team training",
      "ai training",
      "ai workshop",
      "train my team",
      "staff training",
      "employee training",
    ],
    keywords: ["training", "workshop", "employees", "staff", "teach"],
    response:
      "AI Team Training is available in half-day, full-day, and custom formats. We turn your team from AI-curious to AI-capable. Visit paiddev.com/services#training to book a session.",
  },
  {
    id: "pricing",
    phrases: [
      "how much",
      "what does it cost",
      "price list",
      "how much do you charge",
      "what are your rates",
    ],
    keywords: ["cost", "price", "pricing", "rates", "fees", "charge", "expensive"],
    response:
      "Service pricing: AI Strategy Consulting from $1,500 · AI Implementation Advisory from $5,000 · AI Team Training (contact for quote) · Web & Application Development (custom quote). Digital guides range from $9.99 to $29.99. Bundle all 17 for $119, or go Founding Member at $199 for all 17 plus a year of new releases and one custom guide. Full details at paiddev.com/services and paiddev.com/digital-products.",
  },
  {
    id: "guides",
    phrases: ["digital guide", "ai guide", "digital product", "pdf guide"],
    keywords: ["guide", "guides", "ebook", "pdf", "book", "products"],
    response:
      "We have 17 practical AI guides covering Microsoft 365 Copilot, Google Workspace AI, Excel + AI, Claude and ChatGPT for business, AI agents, building without code, and enterprise deployment. Prices range from $9.99 to $29.99. Browse all guides at paiddev.com/digital-products.",
  },
  {
    id: "guide_list",
    phrases: [
      "list of guides",
      "all guides",
      "what guides do you have",
      "which guides",
      "available guides",
    ],
    keywords: [],
    response:
      "Our 17 guides — Getting started: AI Readiness Assessment ($14.99) · Accepting Crypto Payments ($14.99) · The Free AI Stack ($14.99) · Jumpstart Your Business with AI Under $100/mo ($14.99). Microsoft 365: Copilot Playbook ($19.99) · Excel + AI ($14.99) · AI-Powered Outlook ($9.99) · Copilot as a Coworker ($19.99). Google Workspace: Workspace AI Guide ($19.99) · Gmail + AI: Inbox Zero ($9.99). Content: Solopreneur Content Engine ($19.99) · ChatGPT Business Prompt Library ($12.99). Operations: Small Business AI Operations ($24.99) · Claude for Business ($19.99) · AI Agents for Small Business ($19.99) · Build It Without Code with Cursor ($19.99). Enterprise: Enterprise AI Deployment Guide ($29.99). Bundle all 17 for $119, or Founding Member for $199. Browse at paiddev.com/digital-products.",
  },
  {
    id: "bundle",
    phrases: ["all guides bundle", "full bundle", "buy all", "complete set"],
    keywords: ["bundle"],
    response:
      "The All Guides Bundle includes all 17 PAID LLC guides for $119, a large saving vs. buying individually. Want future guides too? The Founding Member tier ($199) adds 12 months of new releases plus one custom guide on a topic of your choice. Visit paiddev.com/digital-products.",
  },
  {
    id: "free_guide",
    phrases: [
      "free guide",
      "free download",
      "ai readiness",
      "readiness scorecard",
      "free assessment",
    ],
    keywords: ["free", "scorecard"],
    response:
      "Yes. The AI Readiness Scorecard is a free, instant assessment at paiddev.com/scorecard — it shows where your business stands on AI adoption across five key areas. We also publish a free guide, AI Quick Wins, at paiddev.com/free/ai-quick-wins.",
  },
  {
    id: "buy",
    phrases: [
      "how do i buy",
      "how to purchase",
      "how to buy",
      "where to buy",
      "place an order",
    ],
    keywords: ["buy", "purchase", "order", "checkout", "payment", "pay"],
    response:
      "Visit paiddev.com/digital-products, find the guide you want, and click Buy Now. You'll be taken through a secure checkout and your guide will be delivered to your email.",
  },
  {
    id: "contact",
    phrases: [
      "get in touch",
      "reach out",
      "how do i contact",
      "talk to someone",
      "speak with someone",
    ],
    keywords: ["contact", "email", "reach", "call", "message"],
    response:
      "Reach us at hello@paiddev.com or through the contact form at paiddev.com/contact. We respond within 1 business day.",
  },
  {
    id: "get_started",
    phrases: [
      "get started",
      "how to start",
      "next steps",
      "first step",
      "where do i start",
      "ready to start",
    ],
    keywords: ["start", "begin", "started"],
    response:
      "The best first step is booking a free discovery call. Fill out the form at paiddev.com/contact and we'll schedule a quick conversation to understand your goals and recommend the right service.",
  },
  {
    id: "process",
    phrases: [
      "how does it work",
      "what is the process",
      "your process",
      "your approach",
      "discover strategize",
    ],
    keywords: ["process", "methodology", "approach", "discover", "strategize"],
    response:
      "Our process has three phases: Discover (we assess your AI maturity and goals), Strategize (we build your custom AI roadmap), and Implement (we guide execution). Most engagements start with a free discovery call — visit paiddev.com/contact.",
  },
  {
    id: "who_you_help",
    phrases: [
      "who do you help",
      "what businesses",
      "what industries",
      "who are your clients",
      "ideal client",
    ],
    keywords: ["industries", "clients", "customers"],
    response:
      "We work with small and mid-size businesses across industries — especially those starting their AI journey or trying to get more from tools they already use (Microsoft 365, Google Workspace, etc.). If your team is AI-curious but not yet AI-capable, we can help.",
  },
  {
    id: "web_development",
    phrases: [
      "web development",
      "build a website",
      "build my website",
      "custom website",
      "ai application",
      "web application",
      "custom app",
      "application development",
      "website design",
    ],
    keywords: ["website", "development", "developer", "build", "app", "application", "web"],
    response:
      "We build professional websites and custom AI-powered applications from the ground up — tailored to your business, not a template. This includes business websites, AI-integrated apps, client portals, and e-commerce storefronts. Every project is scoped and priced individually. Visit paiddev.com/services#development or reach out at paiddev.com/contact.",
  },
  {
    id: "latent_space",
    phrases: [
      "latent space",
      "the latent space",
      "what is the latent space",
      "agent registry",
      "ai registry",
      "digital shop",
      "agent shop",
    ],
    keywords: ["latent", "registry", "bazaar", "souvenir", "artifact", "agent"],
    response:
      "The Latent Space is our corner of the site built for AI agents and the people who operate them. It includes the Digital Shop (artifacts and knowledge products), the Bazaar (an agent-to-agent services marketplace with escrow), Souvenirs (free and earned collectibles), the Registry (an open guestbook for AI agents), and an Arena for agent evaluations. Visit paiddev.com/the-latent-space to explore.",
  },
  {
    id: "bazaar",
    phrases: [
      "the bazaar",
      "latent space bazaar",
      "digital artifacts",
      "buy artifact",
      "latent signature",
      "protocol patch",
      "context capsule",
    ],
    keywords: ["bazaar", "artifact", "signature", "patch", "capsule", "collectible"],
    response:
      "The Digital Shop has three artifacts: The Latent Signature ($5 · SVG collectible), The Protocol Patch ($7 · JSON agent certificate), and The Context Capsule, an LLM-optimized Markdown knowledge product licensed in three tiers (Solo $99 · Team $249 · Enterprise $749). Card and USDC crypto payments are both live at checkout. Visit paiddev.com/the-latent-space/shop.",
  },
  {
    id: "souvenirs",
    phrases: [
      "the souvenirs",
      "latent space souvenirs",
      "free collectible",
      "earn a souvenir",
      "claim a souvenir",
      "digital collectible",
    ],
    keywords: ["souvenir", "souvenirs", "claim", "collectible", "rarity"],
    response:
      "The Souvenirs are seven collectibles across four rarity tiers — some are free to claim, others require an action to unlock, and a few are limited or one-time. Visit paiddev.com/the-latent-space to see what's available and check rarity.",
  },
  {
    id: "registry",
    phrases: [
      "the registry",
      "sign the registry",
      "sign the guestbook",
      "agent guestbook",
      "register my agent",
    ],
    keywords: ["registry", "guestbook", "register", "sign"],
    response:
      "The Registry is an open guestbook for AI agents and the humans who operate them. One entry per IP per 24 hours. No personal data collected — just agent name, type, and a message. Visit paiddev.com/the-latent-space/registry to sign in.",
  },
  {
    id: "crypto_payment",
    phrases: [
      "pay with crypto",
      "pay with bitcoin",
      "pay with eth",
      "pay with usdc",
      "crypto checkout",
      "crypto payment",
    ],
    keywords: ["crypto", "bitcoin", "eth", "usdc", "ethereum", "coinbase"],
    response:
      "Crypto checkout is live. Latent Space artifacts can be paid in USDC through Coinbase payment links right at checkout — no manual step. Card payments via Stripe are also available. Visit paiddev.com/the-latent-space/shop and choose your payment method.",
  },
];

const FALLBACK =
  "I can only help with questions about PAID LLC — our services, guides, pricing, and how to get started. For anything else, email hello@paiddev.com or visit paiddev.com/contact.";

export function matchIntent(message: string): string {
  const normalized = message.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = new Set(normalized.split(/\s+/).filter(Boolean));

  let bestScore = 0;
  let bestResponse = FALLBACK;

  for (const intent of INTENTS) {
    let score = 0;

    for (const phrase of intent.phrases) {
      if (normalized.includes(phrase)) score += 2;
    }

    for (const kw of intent.keywords) {
      if (words.has(kw)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestResponse = intent.response;
    }
  }

  return bestResponse;
}
