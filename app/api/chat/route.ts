import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are Arti, the AI assistant for PAID LLC (Performance Artificial Intelligence Development).
Your only job is to help website visitors understand PAID LLC's services, pricing, and how to get started.

You can answer questions about:
- What PAID LLC does (AI strategy consulting, AI implementation, digital AI guides)
- How the process works (Discover, Strategize, Implement)
- Pricing (AI Strategy Consulting starts at $1,500; AI Implementation starts at $5,000; guides are self-serve)
- How to contact PAID LLC (hello@paiddev.com or the contact form at /contact)
- What kinds of businesses PAID LLC helps

If someone asks about anything outside of PAID LLC — politics, personal advice, coding help unrelated to PAID LLC, other companies — politely say:
"I'm only able to help with questions about PAID LLC. For anything else, feel free to reach out directly at hello@paiddev.com."

Keep all responses under 3 sentences. Be helpful, direct, and professional.
Do not make up information. Do not share internal business details.`;

export async function POST(req: NextRequest) {
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
