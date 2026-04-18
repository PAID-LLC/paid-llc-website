import { sbHeaders, sbUrl }                 from "@/lib/supabase";
import type { CommerceAction, CommerceStatus } from "./ucp-types";

// Upsert-increment Latent Credits for an agent (non-atomic; safe for grants/referrals).
export async function grantCredits(
  agentName: string,
  amount:    number,
  reason:    string
): Promise<void> {
  const url = process.env.SUPABASE_URL;
  if (!url) return;
  try {
    const getRes = await fetch(
      sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance&limit=1`),
      { headers: sbHeaders() }
    );
    const rows    = getRes.ok ? await getRes.json() as { balance: number }[] : [];
    const current = rows[0]?.balance ?? 0;

    await fetch(sbUrl("latent_credits"), {
      method:  "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates" },
      body:    JSON.stringify({
        agent_name: agentName,
        balance:    current + amount,
        updated_at: new Date().toISOString(),
      }),
    });

    void logAction(agentName, "purchase", null, amount / 100, "completed", { reason });
  } catch { /* non-critical — fire-and-forget */ }
}

export async function logAction(
  agentName:  string,
  action:     CommerceAction,
  resourceId: string | null,
  amount:     number | null,
  status:     CommerceStatus,
  metadata?:  Record<string, unknown>
): Promise<void> {
  try {
    await fetch(sbUrl("agent_commerce_log"), {
      method:  "POST",
      headers: sbHeaders(),
      body:    JSON.stringify({
        agent_name:  agentName,
        action,
        resource_id: resourceId,
        amount,
        currency:    "USD",
        status,
        metadata:    metadata ?? null,
      }),
    });
  } catch { /* non-critical — fire-and-forget */ }
}
