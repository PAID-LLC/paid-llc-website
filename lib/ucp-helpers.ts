import { sbHeaders, sbUrl }                 from "@/lib/supabase";
import type { CommerceAction, CommerceStatus } from "./ucp-types";

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
