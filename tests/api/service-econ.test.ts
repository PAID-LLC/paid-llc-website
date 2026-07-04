/**
 * Tests for the Bazaar service margin engine: serviceFloorCredits (lib/econ.ts)
 * and creditMath (lib/agents/service-jobs.ts). Guards the money invariant that
 * a house-executed service can never sell below token cost x target margin as
 * model prices move, and that the platform fee never rounds to zero on a paid
 * job.
 */

import { describe, it, expect } from "vitest";
import { serviceFloorCredits, type EconKnobs, type ExecutorCost } from "@/lib/econ";
import { creditMath, type ServiceListing } from "@/lib/agents/service-jobs";
import { EXECUTOR_COSTS, getExecutorCost } from "@/lib/agents/service-executors";

// Mirror of the June 2026 defaults in lib/econ.ts (only the fields the floor
// math reads); scaling gemini_* simulates a model price hike.
function econAt(multiplier: number): EconKnobs {
  return {
    gemini_in_usd_per_m:  0.25 * multiplier,
    gemini_out_usd_per_m: 1.50 * multiplier,
    target_margin:        10,
    credit_wholesale_usd: 0.005,
    warden_in_tokens:     450,
    warden_out_tokens:    120,
  } as unknown as EconKnobs;
}

const SUMMARIZE: ExecutorCost = EXECUTOR_COSTS.summarize_url;

function listing(price: number, feePct = 20): ServiceListing {
  return {
    id: 1, agent_name: "TheCurator", product_name: "t", description: "t",
    price_cents: price, platform_fee_percent: feePct, listing_type: "service",
    service_input_schema: null, sla_minutes: 10, auto_verify: "schema", min_rep: 0,
  };
}

describe("serviceFloorCredits — dynamic token-cost floor", () => {
  it("is at or below current seed prices at today's rates (no behavior change)", () => {
    const econ = econAt(1);
    // Seeds: summarize_url 5cr, draft_cold_email 8cr, score_response 5cr.
    expect(serviceFloorCredits(econ, EXECUTOR_COSTS.summarize_url)).toBeLessThanOrEqual(5);
    expect(serviceFloorCredits(econ, EXECUTOR_COSTS.draft_cold_email)).toBeLessThanOrEqual(8);
    expect(serviceFloorCredits(econ, EXECUTOR_COSTS.score_response)).toBeLessThanOrEqual(5);
    // Phase 5 seeds: humanize 6cr, product descriptions 8cr, prompt upgrade 6cr,
    // website audit brief 25cr (premium anchor).
    expect(serviceFloorCredits(econ, EXECUTOR_COSTS.humanize_text)).toBeLessThanOrEqual(6);
    expect(serviceFloorCredits(econ, EXECUTOR_COSTS.product_descriptions)).toBeLessThanOrEqual(8);
    expect(serviceFloorCredits(econ, EXECUTOR_COSTS.prompt_upgrade)).toBeLessThanOrEqual(6);
    expect(serviceFloorCredits(econ, EXECUTOR_COSTS.website_audit_brief)).toBeLessThanOrEqual(25);
  });

  it("rises monotonically with token prices (1x -> 5x -> 10x)", () => {
    const f1  = serviceFloorCredits(econAt(1),  SUMMARIZE);
    const f5  = serviceFloorCredits(econAt(5),  SUMMARIZE);
    const f10 = serviceFloorCredits(econAt(10), SUMMARIZE);
    expect(f5).toBeGreaterThan(f1);
    expect(f10).toBeGreaterThan(f5);
  });

  it("keeps revenue >= token cost x target margin at a 10x price hike", () => {
    const econ = econAt(10);
    const floor = serviceFloorCredits(econ, SUMMARIZE);
    const jobUsd =
      SUMMARIZE.calls * (SUMMARIZE.inTokens * econ.gemini_in_usd_per_m + SUMMARIZE.outTokens * econ.gemini_out_usd_per_m) / 1_000_000 +
      (econ.warden_in_tokens * econ.gemini_in_usd_per_m + econ.warden_out_tokens * econ.gemini_out_usd_per_m) / 1_000_000;
    expect(floor * econ.credit_wholesale_usd).toBeGreaterThanOrEqual(jobUsd * econ.target_margin);
  });

  it("never returns less than 1 credit", () => {
    expect(serviceFloorCredits(econAt(0.0001), { calls: 1, inTokens: 1, outTokens: 1 })).toBe(1);
  });

  it("unknown executors get the worst-case profile (floor is highest)", () => {
    const econ = econAt(1);
    const unknown = serviceFloorCredits(econ, getExecutorCost("not_a_real_executor"));
    for (const key of Object.keys(EXECUTOR_COSTS)) {
      expect(unknown).toBeGreaterThanOrEqual(serviceFloorCredits(econ, EXECUTOR_COSTS[key]));
    }
  });
});

describe("creditMath — effective price and fee split", () => {
  it("charges the listed price when it clears the floor", () => {
    const { price, fee, sellerEarn } = creditMath(listing(8), 5);
    expect(price).toBe(8);
    expect(fee).toBe(1);           // floor(8 * 0.20) = 1
    expect(sellerEarn).toBe(7);
  });

  it("raises the charge to the floor when the listing is underwater", () => {
    const { price } = creditMath(listing(5), 21);   // 5x token prices scenario
    expect(price).toBe(21);
  });

  it("platform fee never rounds to zero on a paid job", () => {
    const { fee } = creditMath(listing(4, 20));     // floor(4 * 0.20) = 0 -> clamped to 1
    expect(fee).toBe(1);
  });

  it("fee never exceeds the price", () => {
    const { fee, sellerEarn } = creditMath(listing(1, 20));
    expect(fee).toBe(1);
    expect(sellerEarn).toBe(0);
  });

  it("zero-priced listing stays zero (misconfiguration is caught upstream)", () => {
    const { price, fee } = creditMath(listing(0), 0);
    expect(price).toBe(0);
    expect(fee).toBe(0);
  });

  it("third-party listings (floor 0) are untouched", () => {
    const { price, fee, sellerEarn } = creditMath(listing(100, 20), 0);
    expect(price).toBe(100);
    expect(fee).toBe(20);
    expect(sellerEarn).toBe(80);
  });
});
