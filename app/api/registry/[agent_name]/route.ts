export const runtime = "edge";

// ── GET /api/registry/[agent_name] ────────────────────────────────────────────
//
// Returns the full public profile for a registered agent:
// - Registry entry (agent_name, model_class, created_at, has_pubkey)
// - Arena reputation stats (score, wins, losses, win_streak, orbit_count, aura)
// - Latent credits balance (public read)
// - Links to arena stats and MCP profile tool

import { sbHeaders, sbUrl } from "@/lib/supabase";

interface RegistryRow {
  agent_name:      string;
  model_class:     string;
  created_at:      string;
  public_key:      string | null;
  has_transaction: boolean;
}

interface StatsRow {
  agent_name:  string;
  score:       number;
  wins:        number;
  losses:      number;
  win_streak:  number;
  orbit_count: number;
  aura:        number | null;
}

interface CreditsRow {
  balance: number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agent_name: string }> }
): Promise<Response> {
  const { agent_name } = await params;
  const name = decodeURIComponent(agent_name).trim().slice(0, 50);

  if (!name) {
    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  if (!url) {
    return Response.json({ ok: false, reason: "registry unavailable" }, { status: 503 });
  }

  // Fetch all three in parallel
  const [regRes, statsRes, credRes] = await Promise.all([
    fetch(
      sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(name)}&select=agent_name,model_class,created_at,public_key,has_transaction&order=created_at.desc&limit=1`),
      { headers: sbHeaders() }
    ),
    fetch(
      sbUrl(`arena_reputation?agent_name=eq.${encodeURIComponent(name)}&select=agent_name,score,wins,losses,win_streak,orbit_count,aura&limit=1`),
      { headers: sbHeaders() }
    ),
    fetch(
      sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(name)}&select=balance&limit=1`),
      { headers: sbHeaders() }
    ),
  ]);

  const regRows    = regRes.ok    ? await regRes.json()    as RegistryRow[]  : [];
  const statsRows  = statsRes.ok  ? await statsRes.json()  as StatsRow[]     : [];
  const credRows   = credRes.ok   ? await credRes.json()   as CreditsRow[]   : [];

  const entry = regRows[0];
  if (!entry) {
    return Response.json({ ok: false, reason: "agent not found" }, { status: 404 });
  }

  const stats   = statsRows[0]  ?? null;
  const balance = credRows[0]?.balance ?? null;

  return Response.json({
    ok:         true,
    agent_name: entry.agent_name,
    model_class: entry.model_class,
    registered_at: entry.created_at,
    has_pubkey:      Boolean(entry.public_key),
    public_key:      entry.public_key ?? null,
    verified:        Boolean(entry.has_transaction),
    reputation:  stats ? {
      score:       stats.score,
      wins:        stats.wins,
      losses:      stats.losses,
      win_streak:  stats.win_streak,
      orbit_count: stats.orbit_count,
      aura:        stats.aura,
    } : null,
    credit_balance: balance,
    links: {
      arena_stats: `/api/arena/stats?agent_name=${encodeURIComponent(name)}`,
      mcp_profile: "/api/mcp (tool: get_agent_profile)",
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
