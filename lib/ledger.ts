// ── Unified sales ledger helpers ──────────────────────────────────────────────
// One row per revenue event across every payment rail (Stripe, Coinbase CDP,
// Coinbase Commerce, x402, manual). Backs /api/admin/sales reporting and
// /api/admin/reconcile. Schema: db/sales-ledger.sql.
//
// Both helpers are fire-safe: they never throw and never block fulfillment.
// If the table is missing or Supabase is down, the sale still completes and
// reconciliation catches the gap later.

import { sbUrl, sbHeaders, supabaseReady } from "@/lib/supabase";

export type LedgerSource =
  | "stripe" | "coinbase_cdp" | "coinbase_commerce" | "x402" | "manual";

export type LedgerEventType =
  | "guide_sale" | "credit_pack" | "bazaar_sale" | "tip"
  | "consulting" | "refund" | "other";

export type ProvisioningStatus = "pending" | "delivered" | "failed" | "n/a";

export interface LedgerEntry {
  source:               LedgerSource;
  event_type:           LedgerEventType;
  external_id:          string;            // unique per sale — webhook retries dedupe on this
  gross_cents:          number;
  fee_cents?:           number;
  product_slug?:        string;
  product_name?:        string;
  customer_email?:      string;
  agent_name?:          string;
  provisioning_status?: ProvisioningStatus;
  provisioning_detail?: string;
  occurred_at?:         string;            // ISO; defaults to now() in the DB
  metadata?:            Record<string, unknown>;
}

/** Estimated processor fee in cents. Stripe: 2.9% + 30¢. Coinbase Commerce: 1%. x402: 0. */
export function estimateFeeCents(source: LedgerSource, grossCents: number): number {
  if (grossCents <= 0) return 0;
  switch (source) {
    case "stripe":            return Math.round(grossCents * 0.029) + 30;
    case "coinbase_cdp":
    case "coinbase_commerce": return Math.round(grossCents * 0.01);
    default:                  return 0;
  }
}

/**
 * Insert a sale into the ledger. Idempotent on external_id
 * (Prefer: resolution=ignore-duplicates — retried webhooks insert once).
 * Returns true if the row exists after the call (inserted or duplicate).
 */
export async function recordSale(entry: LedgerEntry): Promise<boolean> {
  if (!supabaseReady() || !entry.external_id) return false;

  const fee = entry.fee_cents ?? estimateFeeCents(entry.source, entry.gross_cents);
  const row = {
    source:              entry.source,
    event_type:          entry.event_type,
    external_id:         entry.external_id,
    gross_cents:         Math.max(0, Math.round(entry.gross_cents)),
    fee_cents:           Math.max(0, Math.round(fee)),
    net_cents:           Math.max(0, Math.round(entry.gross_cents - fee)),
    product_slug:        entry.product_slug ?? null,
    product_name:        entry.product_name ?? null,
    customer_email:      entry.customer_email ?? null,
    agent_name:          entry.agent_name ?? null,
    provisioning_status: entry.provisioning_status ?? "pending",
    provisioning_detail: entry.provisioning_detail ?? null,
    ...(entry.occurred_at ? { occurred_at: entry.occurred_at } : {}),
    metadata:            entry.metadata ?? null,
  };

  const res = await fetch(
    sbUrl("sales_ledger?on_conflict=external_id"),
    {
      method:  "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body:    JSON.stringify(row),
    }
  ).catch(() => null);

  if (!res) return false;
  if (!res.ok) {
    console.error("[ledger] recordSale failed:", res.status, entry.external_id);
    return false;
  }
  return true;
}

/** Update provisioning status after a delivery attempt. Never throws. */
export async function markProvisioned(
  externalId: string,
  status:     ProvisioningStatus,
  detail?:    string
): Promise<void> {
  if (!supabaseReady() || !externalId) return;
  await fetch(
    sbUrl(`sales_ledger?external_id=eq.${encodeURIComponent(externalId)}`),
    {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({
        provisioning_status: status,
        provisioned_at:      status === "delivered" ? new Date().toISOString() : null,
        ...(detail ? { provisioning_detail: detail.slice(0, 500) } : {}),
      }),
    }
  ).catch(() => { /* reconcile catches it */ });
}
