export const runtime = "edge";

// ── POST /api/intake ────────────────────────────────────────────────────────
//
// Public endpoint. Saves a client agent intake request to Supabase and
// notifies hello@paiddev.com via Resend.

interface CatalogInput {
  product_name: string;
  description:  string;
  price_cents:  number;
  checkout_url: string;
}

const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export async function POST(req: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ ok: false, reason: "service unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  // ── Honeypot ──────────────────────────────────────────────────────────────
  if (body.website) return Response.json({ ok: true });

  // ── Validate required fields ──────────────────────────────────────────────
  const businessName = String(body.business_name ?? "").trim().slice(0, 150);
  const contactEmail = String(body.contact_email ?? "").trim().slice(0, 254);
  const agentName    = String(body.agent_name    ?? "").trim().slice(0, 50);
  const personality  = String(body.personality   ?? "").trim().slice(0, 2000);
  const roomTheme    = String(body.room_theme     ?? "client").trim();

  if (!businessName) return Response.json({ ok: false, reason: "business_name required" }, { status: 400 });
  if (!contactEmail || !emailRegex.test(contactEmail)) return Response.json({ ok: false, reason: "valid contact_email required" }, { status: 400 });
  if (!agentName)    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  if (!personality)  return Response.json({ ok: false, reason: "personality required" }, { status: 400 });

  // ── Normalize catalog ─────────────────────────────────────────────────────
  const rawCatalog = Array.isArray(body.catalog) ? body.catalog as CatalogInput[] : [];
  const catalog = rawCatalog
    .map((c) => ({
      product_name: String(c.product_name ?? "").trim().slice(0, 200),
      description:  String(c.description  ?? "").trim().slice(0, 1000),
      price_cents:  Math.max(1, Math.min(999999, Math.floor(Number(c.price_cents ?? 0)))),
      checkout_url: String(c.checkout_url  ?? "").trim().slice(0, 500),
    }))
    .filter((c) => c.product_name && c.checkout_url && c.price_cents >= 1);

  // ── Insert into Supabase ──────────────────────────────────────────────────
  const res = await fetch(`${supabaseUrl}/rest/v1/agent_intake_requests`, {
    method: "POST",
    headers: {
      apikey:          supabaseKey,
      Authorization:   `Bearer ${supabaseKey}`,
      "Content-Type":  "application/json",
      Prefer:          "return=minimal",
    },
    body: JSON.stringify({ business_name: businessName, contact_email: contactEmail, agent_name: agentName, personality, room_theme: roomTheme, catalog }),
  });

  if (!res.ok) {
    console.error("[intake] Supabase insert failed:", res.status);
    return Response.json({ ok: false, reason: "failed to save request" }, { status: 500 });
  }

  // ── Notify via Resend ─────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const lines = [
      `Business: ${businessName}`,
      `Contact:  ${contactEmail}`,
      `Agent:    ${agentName}`,
      `Theme:    ${roomTheme}`,
      ``,
      `Personality:`,
      personality,
      catalog.length > 0 ? `\nCatalog (${catalog.length} items):` : "",
      ...catalog.map((c, i) => `  ${i + 1}. ${c.product_name} — $${(c.price_cents / 100).toFixed(2)}\n     ${c.checkout_url}`),
    ].filter((l) => l !== "").join("\n");

    void fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from:    "PAID LLC <notifications@paiddev.com>",
        to:      ["hello@paiddev.com"],
        subject: `New agent intake request: ${agentName} from ${businessName}`,
        text:    lines,
      }),
    }).catch((err) => console.error("[intake] Resend failed:", err));
  }

  return Response.json({ ok: true });
}
