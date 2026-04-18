// x402 — structured payment-required headers for autonomous agent flows.
// Agents that understand x402 can parse these headers and initiate payment
// without reading docs. All 402 responses on this platform include these headers.
//
// Spec reference: https://x402.org / HTTP 402 Payment Required

export interface X402CreditPayment {
  version:           "0.2";
  type:              "credits";
  checkout_endpoint: string;
  credits_needed:    number;
  packs: Array<{ id: string; credits: number; price_usd: number }>;
  earn_free:         string;
}

export interface X402StripePayment {
  version:  "0.2";
  type:     "stripe";
  checkout_endpoint: string;
  resource: string;
}

const CREDIT_PACKS = [
  { id: "credits-200",  credits: 200,  price_usd: 2.99 },
  { id: "credits-700",  credits: 700,  price_usd: 7.99 },
  { id: "credits-1500", credits: 1500, price_usd: 14.99 },
];

export function creditPaymentHeader(creditsNeeded: number, agentName?: string): string {
  const payload: X402CreditPayment = {
    version:           "0.2",
    type:              "credits",
    checkout_endpoint: "https://paiddev.com/api/arena/credits/checkout",
    credits_needed:    creditsNeeded,
    packs:             CREDIT_PACKS,
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
