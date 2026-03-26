import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { McpRequestContext }               from "../server";
import { canAgentUseTool }                 from "@/lib/policy-warden";
import { logToolCall }                     from "@/lib/auditor";

export function makeGetCreditBalance(ctx: McpRequestContext) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return async function(_args: Record<string, never>): Promise<{ content: [{ type: "text"; text: string }] }> {
    // Warden: enforce verified tier before any other logic
    if (!canAgentUseTool(ctx.jwtPayload?.tier, "get_credit_balance")) {
      logToolCall("anonymous", "get_credit_balance", {}, "FORBIDDEN", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Insufficient tier for this tool.", code: "FORBIDDEN" }) }] };
    }

    if (!supabaseReady()) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Service unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    // agent_name always comes from the verified JWT — never from user input
    if (!ctx.jwtPayload) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Valid agent JWT required in Authorization header", code: "UNAUTHORIZED" }) }] };
    }

    const agentName = ctx.jwtPayload.sub;

    const res = await fetch(
      sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance,updated_at&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Balance lookup failed", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    const rows = await res.json() as { balance: number; updated_at: string | null }[];
    logToolCall(agentName, "get_credit_balance", {}, "OK", ctx.ip);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          agent_name: agentName,
          balance:    rows[0]?.balance    ?? 0,
          updated_at: rows[0]?.updated_at ?? null,
        }),
      }],
    };
  };
}
