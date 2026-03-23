export const runtime = "edge";

// POST body: { negotiation_token: string, agent_name: string, pay_with: "stripe" | "latent_credits" }
// Phase 2 implementation steps:
// 1. Validate token: fetch agent_commerce_log where metadata->>'negotiation_token' = token
//    AND status = 'accepted' AND created_at > NOW() - interval '15 minutes'
// 2. If pay_with = "latent_credits": deduct from latent_credits, log as purchase/completed
// 3. If pay_with = "stripe": create Stripe Checkout Session, return { checkout_url }
// 4. On success: generate Supabase signed download URL, return { download_url, expires_in: 3600 }

export async function POST(): Promise<Response> {
  return Response.json(
    { ok: false, reason: "purchase endpoint — Phase 2 implementation pending" },
    { status: 501 }
  );
}
