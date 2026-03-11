import { NextRequest, NextResponse } from "next/server";
import { matchIntent } from "@/lib/arti-knowledge";

export const runtime = "edge";

export async function POST(req: NextRequest) {
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
