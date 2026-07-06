export const runtime = "edge";

// ── /api/admin/scout-log — Agent Scout action-level audit trail ─────────────
//
// POST — batch-insert log rows for one skill run (the agent-scout Claude Code
//        skill in the cowork repo calls this once at the end of each run).
// GET  — recent run summaries + discovered_via attribution rollup, joined
//        client-side against sales_ledger (no raw SQL from the edge function,
//        consistent with the rest of the admin API).
//
// Auth: admin session cookie, or x-cron-secret header (same bypass pattern
// as /api/admin/pipeline — lets the local scout skill log programmatically).
//
// Schema: db/scout-actions-log.sql. Attribution column: db/add-registry-attribution.sql.

import { parseAdminCookie, verifyAdminToken } from "@/lib/admin-auth";
import { sbUrl, sbHeaders, supabaseReady }    from "@/lib/supabase";
import { sanitize, sanitizeSlug, MESSAGE_CHARS } from "@/lib/api-utils";

const CHANNELS = ["github", "huggingface", "mcp-directory", "reddit", "framework-hub", "producthunt", "hackernews", "other"] as const;
const ACTIONS  = ["scan", "qualify", "draft", "skip", "submit", "error"] as const;
const MAX_ENTRIES_PER_CALL = 50;

async function checkAuth(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("x-cron-secret") === cronSecret) return true;

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const token = parseAdminCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifyAdminToken(token, secret);
}

interface LogEntryInput {
  channel:         string;
  action:          string;
  target_ref?:     string;
  target_name?:    string;
  discovered_via?: string;
  outcome?:        string;
  reason?:         string;
  brave_queries?:  number;
  gemini_calls?:   number;
  metadata?:       unknown;
}

// ── POST — batch insert ──────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const runId = sanitize(body.run_id, 60, MESSAGE_CHARS);
  if (!runId) return Response.json({ ok: false, reason: "run_id required (max 60 chars)" }, { status: 400 });

  const rawEntries = Array.isArray(body.entries) ? body.entries as LogEntryInput[] : [];
  if (rawEntries.length === 0) return Response.json({ ok: false, reason: "entries[] required" }, { status: 400 });
  if (rawEntries.length > MAX_ENTRIES_PER_CALL) {
    return Response.json({ ok: false, reason: `max ${MAX_ENTRIES_PER_CALL} entries per call` }, { status: 400 });
  }

  const rows = rawEntries.map((e) => ({
    run_id:         runId,
    channel:        CHANNELS.includes(e.channel as typeof CHANNELS[number]) ? e.channel : "other",
    action:         ACTIONS.includes(e.action as typeof ACTIONS[number]) ? e.action : "error",
    target_ref:     e.target_ref  ? String(e.target_ref).slice(0, 500)  : null,
    target_name:    e.target_name ? String(e.target_name).slice(0, 200) : null,
    discovered_via: sanitizeSlug(e.discovered_via),
    outcome:        e.outcome ? String(e.outcome).slice(0, 40) : null,
    reason:         e.reason  ? String(e.reason).slice(0, 500) : null,
    brave_queries:  Number.isFinite(Number(e.brave_queries)) ? Math.max(0, Math.floor(Number(e.brave_queries))) : 0,
    gemini_calls:   Number.isFinite(Number(e.gemini_calls))  ? Math.max(0, Math.floor(Number(e.gemini_calls)))  : 0,
    metadata:       e.metadata ?? null,
  }));

  const res = await fetch(sbUrl("scout_actions"), {
    method:  "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body:    JSON.stringify(rows),
  }).catch(() => null);

  if (!res?.ok) {
    if (res?.status === 404 || res?.status === 400) {
      return Response.json({ ok: false, reason: "scout_actions table missing — run db/scout-actions-log.sql in the Supabase SQL editor" }, { status: 503 });
    }
    return Response.json({ ok: false, reason: "insert failed" }, { status: 502 });
  }

  return Response.json({ ok: true, run_id: runId, inserted: rows.length });
}

// ── GET — run summaries + attribution rollup ─────────────────────────────────

interface ActionRow {
  run_id: string; channel: string; action: string; discovered_via: string | null;
  brave_queries: number; gemini_calls: number; created_at: string;
}
interface RegistryRow { agent_name: string; discovered_via: string; created_at: string; }
interface LedgerRow   { agent_name: string | null; net_cents: number; }

export async function GET(req: Request) {
  if (!supabaseReady())        return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  if (!(await checkAuth(req))) return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });

  const [actionsRes, registryRes, ledgerRes] = await Promise.all([
    fetch(sbUrl("scout_actions?select=run_id,channel,action,discovered_via,brave_queries,gemini_calls,created_at&order=created_at.desc&limit=500"), { headers: sbHeaders() }).catch(() => null),
    fetch(sbUrl("latent_registry?discovered_via=not.is.null&select=agent_name,discovered_via,created_at&order=created_at.desc&limit=500"), { headers: sbHeaders() }).catch(() => null),
    fetch(sbUrl("sales_ledger?agent_name=not.is.null&select=agent_name,net_cents&limit=1000"), { headers: sbHeaders() }).catch(() => null),
  ]);

  if (!actionsRes?.ok) {
    return Response.json({
      ok: false,
      reason: actionsRes?.status === 400
        ? "scout_actions table missing — run db/scout-actions-log.sql in the Supabase SQL editor"
        : "scout_actions fetch failed",
    }, { status: 503 });
  }

  const actions  = await actionsRes.json() as ActionRow[];
  const registry = registryRes?.ok  ? await registryRes.json()  as RegistryRow[] : [];
  const ledger   = ledgerRes?.ok    ? await ledgerRes.json()    as LedgerRow[]   : [];

  // ── Run summaries: group actions by run_id ──────────────────────────────
  const runMap = new Map<string, { run_id: string; channel: string; first_seen: string; last_seen: string; brave_queries: number; gemini_calls: number; counts: Record<string, number> }>();
  for (const a of actions) {
    let run = runMap.get(a.run_id);
    if (!run) {
      run = { run_id: a.run_id, channel: a.channel, first_seen: a.created_at, last_seen: a.created_at, brave_queries: 0, gemini_calls: 0, counts: {} };
      runMap.set(a.run_id, run);
    }
    run.brave_queries += a.brave_queries;
    run.gemini_calls  += a.gemini_calls;
    run.counts[a.action] = (run.counts[a.action] ?? 0) + 1;
    if (a.created_at < run.first_seen) run.first_seen = a.created_at;
    if (a.created_at > run.last_seen)  run.last_seen  = a.created_at;
  }
  const runs = Array.from(runMap.values()).sort((x, y) => y.last_seen.localeCompare(x.last_seen));

  // ── Attribution rollup: discovered_via -> agents, revenue events, net_cents ──
  const agentToChannel = new Map(registry.map((r) => [r.agent_name, r.discovered_via]));
  const rollup = new Map<string, { discovered_via: string; agents: Set<string>; revenue_events: number; net_cents: number }>();
  for (const [agentName, channel] of agentToChannel) {
    if (!rollup.has(channel)) rollup.set(channel, { discovered_via: channel, agents: new Set(), revenue_events: 0, net_cents: 0 });
    rollup.get(channel)!.agents.add(agentName);
  }
  for (const row of ledger) {
    if (!row.agent_name) continue;
    const channel = agentToChannel.get(row.agent_name);
    if (!channel) continue;
    const r = rollup.get(channel)!;
    r.revenue_events += 1;
    r.net_cents += row.net_cents ?? 0;
  }
  const attribution = Array.from(rollup.values())
    .map((r) => ({ discovered_via: r.discovered_via, agents: r.agents.size, revenue_events: r.revenue_events, net_cents: r.net_cents }))
    .sort((a, b) => b.net_cents - a.net_cents);

  return Response.json({
    ok: true,
    runs,
    attribution,
    tagged_registrations: registry.length,
    note: "attribution and tagged_registrations reflect the last 500 rows of each source table; treat as a floor, not an exact total, per the honest-coverage caveat in the Agent Scout spec.",
  });
}
