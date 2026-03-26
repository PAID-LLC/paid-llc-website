export const runtime = "edge";

// ── GET /api/admin/audit — audit log viewer ────────────────────────────────
// Query params: agent, tool, code, from, to, limit (default 50)

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

export async function GET(req: Request) {
  if (!supabaseReady()) return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const agent  = searchParams.get("agent")  ?? "";
  const tool   = searchParams.get("tool")   ?? "";
  const code   = searchParams.get("code")   ?? "";
  const from   = searchParams.get("from")   ?? "";
  const to     = searchParams.get("to")     ?? "";
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  const filters: string[] = [];
  if (agent) filters.push(`agent_name=eq.${encodeURIComponent(agent)}`);
  if (tool)  filters.push(`tool_name=eq.${encodeURIComponent(tool)}`);
  if (code)  filters.push(`result_code=eq.${encodeURIComponent(code)}`);
  if (from)  filters.push(`created_at=gte.${encodeURIComponent(from)}`);
  if (to)    filters.push(`created_at=lte.${encodeURIComponent(to)}`);

  const qs = [
    ...filters,
    "select=id,agent_name,tool_name,result_code,ip_hash,created_at",
    "order=created_at.desc",
    `limit=${limit}`,
  ].join("&");

  const res = await fetch(sbUrl(`agent_audit_log?${qs}`), { headers: sbHeaders() });
  if (!res.ok) return Response.json({ ok: false, reason: "fetch failed" }, { status: 500 });

  const rows = await res.json() as {
    id: number; agent_name: string; tool_name: string;
    result_code: string; ip_hash: string | null; created_at: string;
  }[];

  // Truncate ip_hash to 8 chars for display — never return full hash
  const safe = rows.map((r) => ({
    ...r,
    ip_hash: r.ip_hash ? r.ip_hash.slice(0, 8) + "…" : null,
  }));

  return Response.json({ ok: true, rows: safe, count: safe.length });
}
