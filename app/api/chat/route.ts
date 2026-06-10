import { NextRequest, NextResponse } from "next/server";
import { matchIntent } from "@/lib/arti-knowledge";

export const runtime = "edge";

const ALLOWED_ORIGINS = ["https://paiddev.com", "https://www.paiddev.com"];

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  return ALLOWED_ORIGINS.includes(origin) || (!!siteUrl && origin === siteUrl);
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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
      { error: "Message too long. Please keep it under 500 characters." },
      { status: 400 }
    );
  }

  const reply = matchIntent(message);
  return NextResponse.json({ reply });
}
