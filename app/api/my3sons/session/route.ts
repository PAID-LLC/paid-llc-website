export const runtime = "edge";

// ── My 3 Sons: ephemeral Gemini session token ────────────────────────────────
// Validates the partner access token, then mints a short-lived Gemini
// ephemeral token so the browser can open the Live API WebSocket without
// ever seeing the raw GEMINI_API_KEY.

const MODEL = "models/gemini-3.1-flash-live-preview";

function validateToken(req: Request): boolean {
  const token = req.headers.get("x-access-token") ?? "";
  const expected = process.env.MY3SONS_ACCESS_TOKEN ?? "";
  return expected.length > 0 && token === expected;
}

export async function POST(req: Request) {
  if (!validateToken(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? "";
  if (!apiKey) {
    return Response.json({ error: "Gemini API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateEphemeralToken`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({ model: MODEL }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error("Gemini ephemeral token error:", res.status, body);
      return Response.json(
        { error: `Gemini token endpoint returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json() as { token: string; expireTime: string };
    return Response.json({ token: data.token, expireTime: data.expireTime, model: MODEL });
  } catch (err) {
    console.error("Session route error:", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
