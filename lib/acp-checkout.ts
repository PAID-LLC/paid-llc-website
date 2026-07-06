// ── ACP (Agentic Commerce Protocol) checkout session shapes + storage ────────
//
// Sessions are stored as agent_commerce_log rows (action: "purchase",
// metadata.protocol: "acp"), keyed by metadata.acp_session_id — the same
// pattern UCP's negotiation_token already uses (see app/api/ucp/purchase).
// Internal status stays within the existing CommerceStatus union
// (accepted/completed/rejected) so no shared type changes are needed; this
// module translates to/from ACP's own status vocabulary at the boundary.
//
// Real ACP conformance (rfc.agentic_checkout.md) centers on delegated
// payment (a payment credential submitted to POST .../complete). We do not
// have a PSP delegated-payment partnership, so this only implements the
// session lifecycle around our existing hosted Stripe redirect flow —
// spec-shaped, not delegated-payment-capable. See
// references/autoresearch/2026-07-06-acp-checkout-adapter-spec-v1.md.

import { sbHeaders, sbUrl } from "@/lib/supabase";
import type { CommerceStatus } from "@/lib/ucp-types";

export interface AcpLineItem {
  id:           string;
  item:         { id: string; quantity: number };
  base_amount:  number;
  discount:     number;
  subtotal:     number;
  tax:          number;
  total:        number;
}

export interface AcpTotal {
  type:         "items_base_amount" | "subtotal" | "tax" | "total";
  display_text: string;
  amount:       number;
}

export interface AcpMessage {
  type:         "info" | "warning" | "error";
  code:         string;
  content_type: "plain";
  content:      string;
  resolution?:  "recoverable" | "requires_buyer_input" | "requires_buyer_review";
}

export interface AcpCheckoutSession {
  id:                   string;
  status:               "ready_for_payment" | "completed" | "canceled";
  currency:             "usd";
  line_items:           AcpLineItem[];
  totals:               AcpTotal[];
  fulfillment_options:  never[];
  messages:             AcpMessage[];
  links:                { type: "checkout"; url: string }[];
  payment:              { handlers: never[] };
  order?:               { id: string; checkout_session_id: string; permalink_url: string };
}

export interface StoredAcpMetadata {
  protocol?:         "acp";
  acp_session_id?:   string;
  checkout_url?:     string;
  idempotency_key?:  string;
  line_items?:       AcpLineItem[];
  totals?:           AcpTotal[];
}

export interface StoredAcpRow {
  id:       number;
  status:   CommerceStatus;
  metadata: StoredAcpMetadata | null;
}

const STATUS_TO_ACP: Record<CommerceStatus, AcpCheckoutSession["status"]> = {
  accepted:  "ready_for_payment",
  completed: "completed",
  rejected:  "canceled",
  initiated: "ready_for_payment",
  failed:    "canceled",
};

/** Look up a stored session by its public ACP session id (e.g. "cs_<uuid>"). */
export async function fetchAcpSession(sessionId: string): Promise<StoredAcpRow | null> {
  const res = await fetch(
    sbUrl(`agent_commerce_log?metadata->>acp_session_id=eq.${encodeURIComponent(sessionId)}&select=id,status,metadata&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) return null;
  const rows = await res.json() as StoredAcpRow[];
  return rows[0] ?? null;
}

/** Look up a session previously created with the given Idempotency-Key. */
export async function fetchAcpSessionByIdempotencyKey(key: string): Promise<StoredAcpRow | null> {
  const res = await fetch(
    sbUrl(`agent_commerce_log?metadata->>idempotency_key=eq.${encodeURIComponent(key)}&select=id,status,metadata&limit=1`),
    { headers: sbHeaders() }
  );
  if (!res.ok) return null;
  const rows = await res.json() as StoredAcpRow[];
  return rows[0] ?? null;
}

export function toCheckoutSessionJson(row: StoredAcpRow): AcpCheckoutSession {
  const meta   = row.metadata ?? {};
  const status = STATUS_TO_ACP[row.status];
  const id     = meta.acp_session_id ?? `cs_${row.id}`;

  const session: AcpCheckoutSession = {
    id,
    status,
    currency:            "usd",
    line_items:           meta.line_items ?? [],
    totals:               meta.totals ?? [],
    fulfillment_options:  [],
    messages:             [],
    links:                meta.checkout_url ? [{ type: "checkout", url: meta.checkout_url }] : [],
    payment:              { handlers: [] },
  };

  if (status === "completed") {
    session.order = {
      id:                  `ord_${id.replace(/^cs_/, "")}`,
      checkout_session_id: id,
      permalink_url:       "https://paiddev.com/digital-products",
    };
  }

  return session;
}
