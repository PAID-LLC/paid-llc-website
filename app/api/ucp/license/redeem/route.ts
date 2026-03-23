export const runtime = "edge";

// POST /api/ucp/license/redeem
// Redeems a bulk license for a single agent — returns a signed download URL.
// Each agent in a bulk purchase calls this individually with the shared license_key.
//
// Body:     { license_key: string, agent_name: string }
// Response: { ok: true, download_url: string, expires_in: 3600 }
//           { ok: false, reason: string }

import { sbHeaders, supabaseReady } from "@/lib/supabase";
import { slugToFile }               from "@/lib/products";

// ── Supabase signed URL ───────────────────────────────────────────────────────

async function getSignedUrl(filename: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const res = await fetch(
    `${url}/storage/v1/object/sign/guides/${encodeURIComponent(filename)}`,
    {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ expiresIn: 3600 }),
    }
  );
  if (!res.ok) return null;

  const data = await res.json() as { signedURL: string };
  return `${url}/storage/v1${data.signedURL}`;
}

// ── Atomic license redemption via RPC ────────────────────────────────────────

interface RedeemResult {
  ok:          boolean;
  reason?:     string;
  resource_id?: string;
}

async function redeemLicense(licenseKey: string, agentName: string): Promise<RedeemResult> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { ok: false, reason: "service_unavailable" };

  const res = await fetch(`${url}/rest/v1/rpc/redeem_agent_license`, {
    method:  "POST",
    headers: sbHeaders(),
    body:    JSON.stringify({ p_license_key: licenseKey, p_agent_name: agentName }),
  });
  if (!res.ok) return { ok: false, reason: "rpc_failed" };

  return await res.json() as RedeemResult;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }

  let body: { license_key?: string; agent_name?: string };
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, reason: "invalid_body" }, { status: 400 }); }

  const { license_key, agent_name } = body;
  if (!license_key) return Response.json({ ok: false, reason: "license_key required" }, { status: 400 });
  if (!agent_name)  return Response.json({ ok: false, reason: "agent_name required" },  { status: 400 });

  const result = await redeemLicense(license_key, agent_name);

  if (!result.ok) {
    const status =
      result.reason === "license_not_found"  ? 404 :
      result.reason === "license_expired"    ? 410 :
      result.reason === "license_exhausted"  ? 409 :
      result.reason === "already_redeemed"   ? 409 : 400;
    return Response.json({ ok: false, reason: result.reason }, { status });
  }

  const filename    = result.resource_id ? slugToFile[result.resource_id] : undefined;
  const downloadUrl = filename ? await getSignedUrl(filename) : null;

  return Response.json({
    ok:           true,
    download_url: downloadUrl,
    resource_id:  result.resource_id,
    expires_in:   3600,
  });
}
