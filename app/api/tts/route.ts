export const runtime = "edge";

// POST /api/tts
// Edge proxy for ElevenLabs TTS — keeps API key server-side.
// Requires: Authorization: Bearer <JWT>
// Body: { text: string }
// Response: audio/mpeg stream

import { verifyJwt } from "@/lib/jwt";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !(await verifyJwt(token))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return new Response("TTS unavailable", { status: 503 });

  let text: string;
  try {
    const body = await req.json() as { text?: unknown };
    text = String(body.text ?? "").trim().slice(0, 500);
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  if (!text) return new Response("text required", { status: 400 });

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!upstream.ok) return new Response("TTS failed", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
