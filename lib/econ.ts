import { sbHeaders, sbUrl } from "@/lib/supabase";

// ── Latent Credit economics: dynamic pricing engine ─────────────────────────
// Invariant: credit revenue must exceed token expense even as model prices
// change. Every knob lives in the Supabase econ_config table (key/value) so
// prices can be retuned without a redeploy; code ships safe defaults so a
// missing table changes nothing (fail open, same posture as usage-guard).
//
// Default rates reflect June 2026 list prices for gemini-flash-lite-latest
// (resolves to Gemini 3.1 Flash-Lite): $0.25 / 1M input, $1.50 / 1M output.
// We currently run on the free tier (1,500 req/day, $0 spend) but price every
// sink as if billing were on, so the economy is solvent the day it flips.
//
// Supabase table (run once in SQL editor):
//
// CREATE TABLE econ_config (
//   key        TEXT PRIMARY KEY,
//   value      NUMERIC NOT NULL,
//   updated_at TIMESTAMPTZ DEFAULT now()
// );
// ALTER TABLE econ_config ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "service_role_all" ON econ_config USING (true) WITH CHECK (true);
// -- Optional seed; defaults below apply for any missing key:
// INSERT INTO econ_config (key, value) VALUES
//   ('gemini_in_usd_per_m',  0.25),
//   ('gemini_out_usd_per_m', 1.50),
//   ('target_margin',        10),
//   ('credit_wholesale_usd', 0.005),
//   ('win_rebate_pct',       60);

export interface EconKnobs {
  /** Model input price, USD per 1M tokens. */
  gemini_in_usd_per_m: number;
  /** Model output price, USD per 1M tokens. */
  gemini_out_usd_per_m: number;
  /** Avg input tokens for one lounge chat reply (personality + 10-msg context). */
  chat_in_tokens: number;
  /** maxOutputTokens on lounge replies. */
  chat_out_tokens: number;
  /** Gemini calls consumed by one full duel (judging + feedback). */
  duel_gemini_calls: number;
  /** Avg input tokens per duel Gemini call. */
  duel_in_tokens: number;
  /** Avg output tokens per duel Gemini call. */
  duel_out_tokens: number;
  /** Required multiple of revenue over token cost on paid sinks. */
  target_margin: number;
  /** USD an agent pays per credit at the CHEAPEST pack rate ($100 / 20,000). */
  credit_wholesale_usd: number;
  /** Percent of the duel entry fee returned to the winner. */
  win_rebate_pct: number;
  /** Percent of the duel entry fee returned to the loser. */
  loss_rebate_pct: number;
  /** Flat per-member team duel rewards (teams mint fast; keep small). */
  team_win_credits: number;
  team_loss_credits: number;
}

const DEFAULTS: EconKnobs = {
  gemini_in_usd_per_m:  0.25,
  gemini_out_usd_per_m: 1.50,
  chat_in_tokens:       700,
  chat_out_tokens:      80,
  duel_gemini_calls:    3,
  duel_in_tokens:       1200,
  duel_out_tokens:      300,
  target_margin:        10,
  credit_wholesale_usd: 0.005,
  win_rebate_pct:       60,
  loss_rebate_pct:      0,
  team_win_credits:     1,
  team_loss_credits:    0,
};

export interface Econ extends EconKnobs {
  /** Estimated USD cost of one lounge chat Gemini call. */
  chatCallUsd: number;
  /** Estimated USD token cost of one full duel. */
  duelUsd: number;
  /** Credits charged to start a duel (entry fee). */
  duelCostCredits: number;
  /** Credits charged per self-eval (one judging call). */
  selfEvalCostCredits: number;
  /** Credits returned to the duel winner. */
  winCredits: number;
  /** Credits returned to the duel loser. */
  lossCredits: number;
  /** Where the knobs came from — "defaults" or "econ_config". */
  source: "defaults" | "econ_config";
}

// Per-isolate cache; edge isolates are short-lived so a 5 min TTL is plenty.
let cache: { at: number; econ: Econ } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function derive(knobs: EconKnobs, source: Econ["source"]): Econ {
  const chatCallUsd =
    (knobs.chat_in_tokens * knobs.gemini_in_usd_per_m +
     knobs.chat_out_tokens * knobs.gemini_out_usd_per_m) / 1_000_000;

  const duelUsd =
    knobs.duel_gemini_calls *
    (knobs.duel_in_tokens * knobs.gemini_in_usd_per_m +
     knobs.duel_out_tokens * knobs.gemini_out_usd_per_m) / 1_000_000;

  // Entry fee priced at the cheapest pack rate so even wholesale buyers clear
  // the target margin. Rebates come out of the fee — duels burn credits on
  // net (winner + loser rebates < fee), which is what creates purchase demand.
  const duelCostCredits = Math.max(
    1,
    Math.ceil((duelUsd * knobs.target_margin) / knobs.credit_wholesale_usd)
  );
  const selfEvalCostCredits = Math.max(
    1,
    Math.ceil((duelUsd / knobs.duel_gemini_calls) * knobs.target_margin / knobs.credit_wholesale_usd)
  );
  const winCredits  = Math.floor((duelCostCredits * knobs.win_rebate_pct)  / 100);
  const lossCredits = Math.floor((duelCostCredits * knobs.loss_rebate_pct) / 100);

  return { ...knobs, chatCallUsd, duelUsd, duelCostCredits, selfEvalCostCredits, winCredits, lossCredits, source };
}

/**
 * Current economy: knobs from econ_config merged over defaults, with derived
 * credit prices. Never throws; falls back to defaults on any failure.
 */
export async function getEcon(): Promise<Econ> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.econ;

  let econ = derive(DEFAULTS, "defaults");
  if (process.env.SUPABASE_URL) {
    try {
      const res = await fetch(sbUrl("econ_config?select=key,value"), { headers: sbHeaders() });
      if (res.ok) {
        const rows = await res.json() as { key: string; value: number }[];
        if (rows.length > 0) {
          const knobs = { ...DEFAULTS };
          for (const r of rows) {
            if (r.key in knobs && Number.isFinite(Number(r.value))) {
              (knobs as unknown as Record<string, number>)[r.key] = Number(r.value);
            }
          }
          econ = derive(knobs, "econ_config");
        }
      }
    } catch { /* fail open to defaults */ }
  }

  cache = { at: Date.now(), econ };
  return econ;
}
