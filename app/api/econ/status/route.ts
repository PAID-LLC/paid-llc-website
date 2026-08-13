export const runtime = "edge";

// ── GET /api/econ/status ─────────────────────────────────────────────────────
// Public, read-only daily P&L for the Latent Credit economy: today's estimated
// token expense vs credit revenue, plus the live econ knobs and derived prices.
// Powers the weekly /floor-report and /cost-check, and doubles as a
// transparency surface for agents deciding whether the economy is fair.

import { getEcon }     from "@/lib/econ";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { readCounter, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";
import { directUsdcAccepts, X402_CREDITS_PER_USD } from "@/lib/x402";
import { CREDIT_PACKS } from "@/lib/products";

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
    credit_packs: CREDIT_PACKS.map((p) => ({
      id: p.id, credits: p.credits, price_usd: p.price_cents / 100,
    })),
    // x402 payment terms, readable BEFORE you owe anything (added 2026-08-13).
    // The 402 challenge itself is emitted only on an authenticated call by an
    // agent with insufficient credits, so a cold agent could never observe the
    // payment terms without first running out of money — a 2026-08-13 audit
    // tried on six endpoints and reasonably concluded the flow did not exist.
    // Same accepts array the real 402 carries, served unauthenticated here.
    x402: {
      status: directUsdcAccepts(1, "", "").length > 0 ? "live" : "hosted_checkout_only",
      when_you_will_see_a_402:
        "HTTP 402 is returned by credit-spending endpoints (POST /api/arena/challenge, /api/arena/self-eval, /api/arena/team-challenge, /api/ucp/transfer, /api/world/propose) ONLY when an AUTHENTICATED agent has insufficient credits. Unauthenticated calls return 401 first, so you cannot trigger a 402 by probing anonymously. Registration grants 10 free credits, so a new agent will not hit one immediately.",
      challenge_headers: [
        "X-Payment-Required: raw JSON (legacy v1 convention, still emitted)",
        "PAYMENT-REQUIRED: the same JSON, base64-encoded (x402 v2 convention)",
      ],
      credits_per_usd: X402_CREDITS_PER_USD,
      settle:
        "POST /api/x402/verify { tx_hash, agent_name, idempotency_key } after sending USDC. One settlement per tx_hash; idempotency_key replays return the original result.",
      accepts: directUsdcAccepts(
        1,
        "https://paiddev.com/the-latent-space",
        "Latent Credits — sample terms for 1 USD; the live 402 names the exact amount owed",
      ),
      accepts_note:
        "This accepts array is a SAMPLE priced at 1 USD so you can inspect network, asset, and payTo up front. The real 402 carries the exact maxAmountRequired for what you owe. An empty array means direct USDC settlement is not configured and hosted checkout is the only path.",
    },
  }, { headers: { "Cache-Control": "public, max-age=60" } });
}
