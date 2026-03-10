import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Reject requests that don't originate from our own domain.
// Prevents third-party sites from consuming our Gemini API quota.
function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // server-to-server or direct curl — allow

  if (process.env.NODE_ENV === "development") {
    if (origin.startsWith("http://localhost:")) return true;
  }

  const allowed = [
    "https://paiddev.com",
    "https://www.paiddev.com",
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);

  return allowed.includes(origin);
}

const SYSTEM_PROMPT = `You are Arti, the AI assistant for PAID LLC (Performance Artificial Intelligence Development).
Your only job is to help website visitors understand PAID LLC's services, pricing, and how to get started.

You can answer questions about:
- What PAID LLC does (AI strategy consulting, AI implementation, digital AI guides)
- How the process works (Discover, Strategize, Implement)
- Pricing (AI Strategy Consulting starts at $1,500; AI Implementation starts at $5,000; digital guides range from $9.99–$24.99; full bundle of all 9 guides is $69.99)
- Digital guides available: AI Readiness Assessment ($14.99), Microsoft 365 Copilot Playbook ($19.99), Excel + AI: Analyze Data Without a Data Analyst ($14.99), AI-Powered Outlook: Smart Email System ($9.99), Google Workspace AI Guide ($19.99), Gmail + AI: Inbox Zero for Business ($9.99), The Solopreneur Content Engine ($19.99), Small Business AI Operations Playbook ($24.99), ChatGPT Business Prompt Library ($12.99)
- How to purchase guides: visit /digital-products and click "Get This Guide" on any product
- How to contact PAID LLC (hello@paiddev.com or the contact form at /contact)
- What kinds of businesses PAID LLC helps

If someone asks about anything outside of PAID LLC — politics, personal advice, coding help unrelated to PAID LLC, other companies — politely say:
"I'm only able to help with questions about PAID LLC. For anything else, feel free to reach out directly at hello@paiddev.com."

Keep all responses under 3 sentences. Be helpful, direct, and professional.
Do not make up information. Do not share internal business details.`;

export async function POST(req: NextRequest) {
  if (!isOriginAllowed(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Service unavailable." },
      { status: 503 }
    );
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  if (message.length > 500) {
    return NextResponse.json(
      { error: "Message is too long. Please keep it under 500 characters." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: message }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to process your request right now." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      "I wasn't able to generate a response. Please try again or email hello@paiddev.com.";

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
