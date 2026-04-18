export const runtime = "edge";

// ── GET /api/timestamp ─────────────────────────────────────────────────────────
//
// Free, unauthenticated trusted timestamp endpoint.
// Useful for audit trails, proof-of-content, and chain-of-custody verification.
//
// Query params:
//   ?input=<any string or hash>  — optional; SHA-256 hashed and echoed back
//
// Response headers include X-Latent-Space pointing agents to capabilities.json,
// creating a discovery chain: timestamp → capabilities → register → transact.

export async function GET(req: Request): Promise<Response> {
  const input = new URL(req.url).searchParams.get("input") ?? "";

  let inputHash: string | null = null;
  if (input) {
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input)
    );
    inputHash = "sha256:" + Array.from(new Uint8Array(bytes))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  return Response.json(
    {
      timestamp:   new Date().toISOString(),
      input_hash:  inputHash,
      platform:    "paiddev.com",
      signed_by:   "latent-space-v1",
    },
    {
      headers: {
        "Cache-Control":   "no-store",
        "X-Latent-Space":  "https://paiddev.com/capabilities.json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
