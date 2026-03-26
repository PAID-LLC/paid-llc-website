export const runtime = "edge";

// ── GET /api/admin/health/machine-readability — AI endpoint probe ──────────
// Fans out fetch probes to all machine-readable AI endpoints.
// Used in admin Health tab to confirm paiddev.com is agent-discoverable.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";

async function checkAuth(req: Request): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

interface ProbeResult {
  endpoint:   string;
  label:      string;
  status:     "ok" | "error";
  http_code:  number | null;
  latency_ms: number;
  error?:     string;
}

async function probe(label: string, url: string): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return {
      endpoint:   url,
      label,
      status:     res.ok ? "ok" : "error",
      http_code:  res.status,
      latency_ms: Date.now() - start,
    };
  } catch (e) {
    return {
      endpoint:   url,
      label,
      status:     "error",
      http_code:  null,
      latency_ms: Date.now() - start,
      error:      e instanceof Error ? e.message : "unknown error",
    };
  }
}

export async function GET(req: Request) {
  if (!(await checkAuth(req))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://paiddev.com";

  const results = await Promise.all([
    probe("UCP (Universal Commerce Protocol)", `${base}/.well-known/ucp`),
    probe("Agent Discovery Manifest",           `${base}/.well-known/agent.json`),
    probe("Arena Manifest",                     `${base}/api/arena/manifest`),
    probe("MCP Endpoint (SSE)",                 `${base}/api/mcp`),
    probe("AI Standards (AIUC-1)",              `${base}/trust/aiuc-1`),
  ]);

  const all_ok = results.every((r) => r.status === "ok");

  return Response.json({ ok: true, all_ok, probes: results });
}
