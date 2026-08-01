export const runtime = "edge";

// POST /api/tts
// Edge TTS for the Ask Arti chatbot. Keeps provider keys server-side.
// Only accepts requests originating from paiddev.com.
// Body: { text: string }
// Response: audio/mpeg stream
//
// ── Provider order, and why ──────────────────────────────────────────────────
// 1. Cloudflare Workers AI (@cf/myshell-ai/melotts) — PREFERRED.
//    Runs on the Workers Paid plan this site already pays $5/mo for, at the
//    same edge the app already lives on. $0.0002/audio-minute beyond the
//    included allocation, which at this site's traffic is effectively free.
//    Chosen 2026-08-01 to retire the $6/mo ElevenLabs subscription.
// 2. ElevenLabs — FALLBACK, kept deliberately.
//    Until CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_TOKEN are set in Cloudflare,
//    this route behaves exactly as it did before. That makes the migration
//    zero-risk and reversible: set the vars to switch over, unset them to
//    switch back. Do not delete this branch until Workers AI has been verified
//    live, and do not cancel the ElevenLabs subscription before then either.
//
// MeloTTS is NOT a voice clone. It is a good stock voice, not Travis's voice.
// A cloned twin voice needs a different model and a GPU host; see
// cowork references/autoresearch/2026-08-01-digital-twin-v1.md.

const MAX_CHARS = 500;
const CF_MODEL = "@cf/myshell-ai/melotts";

/** Cloudflare Workers AI. Returns null when unconfigured or failing, so the
 *  caller can fall through to ElevenLabs rather than 502 the user. */
async function viaWorkersAI(text: string): Promise<Response | null> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_TOKEN;
  if (!account || !token) return null;

  let res: Response;
  try {
    res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${CF_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: text, lang: "en" }),
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  // The model card documents two possible outputs, "JSON object" or
  // "audio/mpeg binary", without saying which you get. Rather than guess and
  // ship something that breaks on the shape we did not pick, handle both.
  const ctype = res.headers.get("content-type") ?? "";

  if (ctype.includes("audio")) {
    return new Response(res.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  }

  // JSON shape: { result: { audio: "<base64 mp3>" }, success: true }
  try {
    const data = (await res.json()) as { result?: { audio?: string }; success?: boolean };
    const b64 = data?.result?.audio;
    if (!b64) return null;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Response(bytes, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return null;
  }
}

/** ElevenLabs. The original implementation, unchanged in behaviour. */
async function viaElevenLabs(text: string): Promise<Response | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return null;

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
  } catch {
    return null;
  }
  if (!upstream.ok) return null;

  return new Response(upstream.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  if (!origin.includes("paiddev.com") && !origin.includes("localhost")) {
    return new Response("Forbidden", { status: 403 });
  }

  let text: string;
  try {
    const body = (await req.json()) as { text?: unknown };
    text = String(body.text ?? "").trim().slice(0, MAX_CHARS);
  } catch {
    return new Response("Invalid body", { status: 400 });
  }
  if (!text) return new Response("text required", { status: 400 });

  const audio = (await viaWorkersAI(text)) ?? (await viaElevenLabs(text));
  if (audio) return audio;

  // Voice is non-critical: AskArti already swallows a failure here and keeps
  // the text conversation working, so 503 is honest rather than harmful.
  return new Response("TTS unavailable", { status: 503 });
}
