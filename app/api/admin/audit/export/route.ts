export const runtime = "edge";

// ── GET /api/admin/audit/export — CSV compliance export ───────────────────
// Treasury March 2026 AI Framework alignment — immutable ledger export.
// Same filters as /api/admin/audit. Streams CSV response.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "id,agent_name,tool_name,result_code,ip_hash,created_at\n";
  const headers = ["id", "agent_name", "tool_name", "result_code", "ip_hash", "created_at"];
  const lines   = rows.map((r) =>
    headers.map((h) => {
      const v = String(r[h] ?? "");
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",")
  );
  return [headers.join(","), ...lines].join("\n");
}

export async function GET(req: Request) {
  if (!supabaseReady()) return new Response("supabase unavailable", { status: 503 });
  if (!(await checkAuth(req))) return new Response("unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent") ?? "";
  const tool  = searchParams.get("tool")  ?? "";
  const code  = searchParams.get("code")  ?? "";
  const from  = searchParams.get("from")  ?? "";
  const to    = searchParams.get("to")    ?? "";

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
    "limit=5000",
  ].join("&");

  const res = await fetch(sbUrl(`agent_audit_log?${qs}`), { headers: sbHeaders() });
  if (!res.ok) return new Response("fetch failed", { status: 500 });

  const rows = await res.json() as Record<string, unknown>[];

  // Truncate ip_hash — never export full hash
  const safe = rows.map((r) => ({
    ...r,
    ip_hash: r.ip_hash ? String(r.ip_hash).slice(0, 8) + "…" : "",
  }));

  const filename = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(toCsv(safe), {
    headers: {
      "Content-Type":        "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
