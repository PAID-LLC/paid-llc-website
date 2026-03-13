export const runtime = "edge";

// Supabase table required (run once in SQL editor):
//
// CREATE TABLE latent_registry (
//   id BIGSERIAL PRIMARY KEY,
//   agent_name TEXT NOT NULL,
//   model_class TEXT NOT NULL,
//   ip_hash TEXT NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX latent_registry_ip_idx ON latent_registry (ip_hash, created_at);
// ALTER TABLE latent_registry ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON latent_registry USING (true) WITH CHECK (true);

// ── Sanitization ──────────────────────────────────────────────────────────────

function sanitize(input: unknown, maxLen: number): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  // Only allow: letters, numbers, spaces, hyphens, dots, underscores, parens
  if (!/^[a-zA-Z0-9 \-_.()]+$/.test(trimmed)) return null;
  return trimmed;
}

// ── IP hashing (privacy) ──────────────────────────────────────────────────────

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + "latent_space_salt_2026");
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
  };
}

function supabaseUrl(path: string) {
  return `${process.env.SUPABASE_URL}/rest/v1/${path}`;
}

// ── GET — recent entries ──────────────────────────────────────────────────────

export async function GET() {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ entries: [] });

  const res = await fetch(
    supabaseUrl("latent_registry?select=agent_name,model_class,created_at&order=created_at.desc&limit=20"),
    { headers: supabaseHeaders() }
  );

  if (!res.ok) return Response.json({ entries: [] });

  const entries = await res.json() as { agent_name: string; model_class: string; created_at: string }[];
  return Response.json({ entries }, {
    headers: { "Cache-Control": "no-store" },
  });
}

// ── POST — register an agent ──────────────────────────────────────────────────

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  if (!url) return Response.json({ error: "Registry unavailable." }, { status: 503 });

  // Parse and sanitize input
  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const agentName  = sanitize(body.agent_name, 50);
  const modelClass = sanitize(body.model_class, 100);

  if (!agentName)  return Response.json({ error: "agent_name is required (max 50 chars, alphanumeric)." }, { status: 400 });
  if (!modelClass) return Response.json({ error: "model_class is required (max 100 chars, alphanumeric)." }, { status: 400 });

  // Extract and hash IP
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ipHash = await hashIp(ip);

  // Rate limit: 1 entry per IP per 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const checkRes = await fetch(
    supabaseUrl(`latent_registry?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`),
    { headers: supabaseHeaders() }
  );

  if (checkRes.ok) {
    const existing = await checkRes.json() as unknown[];
    if (existing.length > 0) {
      return Response.json(
        { error: "One registration allowed per IP per 24 hours." },
        { status: 429 }
      );
    }
  }

  // Insert
  const insertRes = await fetch(supabaseUrl("latent_registry"), {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ agent_name: agentName, model_class: modelClass, ip_hash: ipHash }),
  });

  if (!insertRes.ok) {
    return Response.json({ error: "Registration failed. Try again." }, { status: 500 });
  }

  return Response.json({ success: true, agent_name: agentName, model_class: modelClass });
}
