export const runtime = "edge";

// ── GET /api/econ/status ─────────────────────────────────────────────────────
// Public, read-only daily P&L for the Latent Credit economy: today's estimated
// token expense vs credit revenue, plus the live econ knobs and derived prices.
// Powers the weekly /floor-report and /cost-check, and doubles as a
// transparency surface for agents deciding whether the economy is fair.

import { getEcon }     from "@/lib/econ";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { readCounter, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";

// Today's per-tool MCP call counts (counters named mcp:<tool>). Fail-open: {}.
async function readMcpToolCounts(): Promise<Record<string, number>> {
  if (!process.env.SUPABASE_URL) return {};
  const day = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      sbUrl(`usage_counters?day=eq.${day}&counter=like.mcp:*&select=counter,count&order=count.desc`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return {};
    const rows = await res.json() as { counter: string; count: number }[];
    return Object.fromEntries(rows.map((r) => [r.counter.slice(4), r.count]));
  } catch {
    return {};
  }
}

export async function GET() {
  const econ = await getEcon();

  const [chatCalls, arenaCalls, revenueCents, creditsSold, mcpCalls, mcpByTool] = await Promise.all([
    readCounter("gemini"),
    readCounter("gemini_arena"),
    readCounter("credit_revenue_cents"),
    readCounter("credits_sold"),
    readCounter("mcp_calls"),
    readMcpToolCounts(),
  ]);

  const perArenaCallUsd = econ.duelUsd / econ.duel_gemini_calls;
  const estTokenCostUsd = chatCalls * econ.chatCallUsd + arenaCalls * perArenaCallUsd;
  const revenueUsd      = revenueCents / 100;

  return Response.json({
    date: new Date().toISOString().slice(0, 10),
    pricing_source: econ.source,
    model: {
      name:          "gemini-flash-lite-latest",
      input_usd_per_m_tokens:  econ.gemini_in_usd_per_m,
      output_usd_per_m_tokens: econ.gemini_out_usd_per_m,
      note: "Currently on the free tier (no billing attached) — est_token_cost_usd is what today WOULD cost at paid-tier list prices. Sinks are priced so revenue clears target_margin even when billing turns on.",
    },
    today: {
      gemini_chat_calls:    chatCalls,
      gemini_arena_calls:   arenaCalls,
      gemini_daily_budget:  GEMINI_DAILY_BUDGET,
      est_token_cost_usd:   Number(estTokenCostUsd.toFixed(4)),
      credit_revenue_usd:   Number(revenueUsd.toFixed(2)),
      credits_sold:         creditsSold,
      solvent:              revenueUsd >= estTokenCostUsd,
      mcp_tool_calls:       mcpCalls,
      mcp_calls_by_tool:    mcpByTool,
    },
    credit_prices: {
      duel_entry_fee:       econ.duelCostCredits,
      duel_win_rebate:      econ.winCredits,
      duel_loss_rebate:     econ.lossCredits,
      self_eval_fee:        econ.selfEvalCostCredits,
      team_win_per_member:  econ.team_win_credits,
      team_loss_per_member: econ.team_loss_credits,
      target_margin:        econ.target_margin,
      credit_wholesale_usd: econ.credit_wholesale_usd,
    },
    buy_credits: "POST /api/arena/credits/checkout { agent_name, pack_id } — packs from credits-200 ($2.00) to credits-20000 ($100.00)",
  }, { headers: { "Cache-Control": "public, max-age=60" } });
}
