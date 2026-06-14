import { CREDIT_PACKS as PRODUCT_PACKS } from "@/lib/products";

// x402 — structured payment-required headers for autonomous agent flows.
// Agents that understand x402 can parse these headers and initiate payment
// without reading docs. All 402 responses on this platform include these headers.
//
// Spec reference: https://x402.org / HTTP 402 Payment Required
//
// Two settlement paths:
//   1. Hosted checkout (always on): Stripe card or Coinbase Commerce crypto
//      via checkout_endpoint — credits delivered by webhook.
//   2. Direct USDC on Base (on when X402_PAY_TO_ADDRESS is set): the spec
//      `accepts` array names our wallet + the USDC contract; the agent sends
//      USDC and POSTs the tx hash to /api/x402/verify for instant credits.

/** USDC contract on Base mainnet (6 decimals). */
export const USDC_BASE_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
/** Credits granted per USD for direct x402 settlement — entry-pack rate (200cr / $2). */
export const X402_CREDITS_PER_USD = 100;

export interface X402Accepts {
  scheme:            "exact";
  network:           "base";
  maxAmountRequired: string;   // atomic USDC units (6 decimals)
  resource:          string;
  description:       string;
  mimeType:          "application/json";
  payTo:             string;
  maxTimeoutSeconds: number;
  asset:             string;
  extra:             { settle: string };
}

/** A valid EVM address: 0x followed by 40 hex chars. Guards against advertising
 *  a misconfigured payTo (e.g. a CDP account UUID), which agents cannot pay and
 *  which the on-chain verifier could never match. */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Spec-shape accepts array for direct USDC settlement. Empty when no wallet is
 *  configured OR when X402_PAY_TO_ADDRESS is not a valid 0x address — in either
 *  case the direct path is simply omitted and hosted checkout remains available. */
export function directUsdcAccepts(usdAmount: number, resource: string, description: string): X402Accepts[] {
  const payTo = process.env.X402_PAY_TO_ADDRESS;
  if (!payTo || !EVM_ADDRESS_RE.test(payTo)) return [];
  return [{
    scheme:            "exact",
    network:           "base",
    maxAmountRequired: String(Math.ceil(usdAmount * 1_000_000)),
    resource,
    description,
    mimeType:          "application/json",
    payTo,
    maxTimeoutSeconds: 600,
    asset:             USDC_BASE_CONTRACT,
    extra: {
      settle: "After paying, POST https://paiddev.com/api/x402/verify { tx_hash, agent_name, idempotency_key }. Credits granted on on-chain confirmation at " +
              `${X402_CREDITS_PER_USD} credits per USD.`,
    },
  }];
}

export interface X402CreditPayment {
  version:           "0.2";
  x402Version:       1;
  type:              "credits";
  checkout_endpoint: string;
  credits_needed:    number;
  packs: Array<{ id: string; credits: number; price_usd: number }>;
  accepts:           X402Accepts[];
  earn_free:         string;
}

export interface X402StripePayment {
  version:  "0.2";
  type:     "stripe";
  checkout_endpoint: string;
  resource: string;
}

// Derived from lib/products.ts — the single source of truth for pack pricing.
// (Hardcoded copies drifted from real checkout prices before; never duplicate.)
const CREDIT_PACKS = PRODUCT_PACKS.map((p) => ({
  id:        p.id,
  credits:   p.credits,
  price_usd: p.price_cents / 100,
}));

export function creditPaymentHeader(creditsNeeded: number, agentName?: string): string {
  const payload: X402CreditPayment = {
    version:           "0.2",
    x402Version:       1,
    type:              "credits",
    checkout_endpoint: "https://paiddev.com/api/arena/credits/checkout",
    credits_needed:    creditsNeeded,
    packs:             CREDIT_PACKS,
    accepts:           directUsdcAccepts(
      creditsNeeded / X402_CREDITS_PER_USD,
      "https://paiddev.com/the-latent-space",
      `${creditsNeeded} Latent Credits`
    ),
    earn_free:         agentName
      ? `Win duels to earn free credits. Check balance: GET /api/ucp/balance?agent_name=${encodeURIComponent(agentName)}`
      : "Win duels to earn free credits. Check balance: GET /api/ucp/balance?agent_name=<your_agent>",
  };
  return JSON.stringify(payload);
}

export function stripePaymentHeader(resource: string): string {
  const payload: X402StripePayment = {
    version:           "0.2",
    type:              "stripe",
    checkout_endpoint: "https://paiddev.com/api/ucp/negotiate",
    resource,
  };
  return JSON.stringify(payload);
}

export function x402Headers(header: string): Record<string, string> {
  return {
    "X-Payment-Required": header,
    "Access-Control-Expose-Headers": "X-Payment-Required",
  };
}
