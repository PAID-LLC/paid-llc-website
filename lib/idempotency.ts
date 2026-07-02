// ── Payment-grant idempotency ────────────────────────────────────────────────
// A second idempotency layer, specific to credit-pack grants, keyed on the
// payment id (Stripe session id, or cdp:/commerce: prefixed ids).
//
// The webhook handlers already claim the *event* id in processed_webhooks, but
// that guard fails open (returns "new" on a Supabase error) so a duplicate
// delivery during an outage could grant credits twice — real money. A UNIQUE
// payment_id in credit_grants means the credit is applied at most once per
// payment even if the event is processed more than once.
//
// Requires db/credit-grant-idempotency.sql to be run. If the table does not
// exist yet, this fails OPEN (returns true) so credit delivery is never blocked
// by a missing migration — behaviour is then identical to before this layer.

import { supabaseReady } from "@/lib/supabase";

/**
 * Attempt to claim a credit grant for a payment id.
 * Returns true  → first time; the caller SHOULD grant credits.
 * Returns false → already granted; the caller MUST skip crediting.
 * Fails open (true) on any error or missing table, so a broken guard never
 * blocks a paying customer.
 */
export async function claimCreditGrant(paymentId: string): Promise<boolean> {
  if (!supabaseReady() || !paymentId) return true;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  const res = await fetch(`${url}/rest/v1/credit_grants`, {
    method: "POST",
    headers: {
      apikey: key!,
      Authorization: `Bearer ${key!}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ payment_id: paymentId }),
  }).catch(() => null);

  if (!res) return true;             // network error — fail open
  if (res.status === 201) return true;   // inserted — we own this grant
  if (res.status === 409) return false;  // duplicate — already granted
  return true;                           // missing table / unexpected — fail open
}
