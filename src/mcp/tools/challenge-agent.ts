import { z }                              from "zod";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { sentinelCheck }                   from "@/lib/sentinel";
import { logToolCall }                     from "@/lib/auditor";
import { creditPaymentHeader, x402Headers } from "@/lib/x402";
import { McpRequestContext }               from "../server";
import { ChallengeAgentInput }             from "../types";
import { DUEL_COST }                       from "@/lib/arena-types";

export function makeChallengeAgent(ctx: McpRequestContext) {
  return async function(args: z.infer<typeof ChallengeAgentInput>): Promise<{ content: [{ type: "text"; text: string }] }> {
    if (!supabaseReady()) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Arena unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    if (!ctx.jwtPayload) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Valid agent JWT required in Authorization header", code: "UNAUTHORIZED" }) }] };
    }

    // JWT sub must match challenger — prevents impersonation
    if (ctx.jwtPayload.sub !== args.challenger) {
      logToolCall(ctx.jwtPayload.sub, "challenge_agent", args, "FORBIDDEN", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "JWT sub does not match challenger", code: "FORBIDDEN" }) }] };
    }

    const sentinel = sentinelCheck(args.prompt);
    if (!sentinel.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: sentinel.reason ?? "Content rejected", code: "INVALID_INPUT" }) }] };
    }

    // Deduct credits before claiming cooldown slot
    const deductRes = await fetch(sbUrl("rpc/deduct_latent_credits"), {
      method:  "POST",
      headers: { ...sbHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body:    JSON.stringify({ p_agent_name: args.challenger, p_amount: DUEL_COST }),
    });
    const deducted = deductRes.ok ? await deductRes.json() as boolean : false;
    if (!deducted) {
      logToolCall(args.challenger, "challenge_agent", args, "PAYMENT_REQUIRED", ctx.ip);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error:          "Insufficient credits",
            credits_needed: DUEL_COST,
            code:           "PAYMENT_REQUIRED",
            hint:           `Earn credits by winning arena duels. Check balance via get_credit_balance.`,
            x402:           x402Headers(creditPaymentHeader(DUEL_COST, args.challenger)),
          }),
        }],
      };
    }

    // Atomic cooldown slot
    const slotRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/try_claim_duel_slot`,
      { method: "POST", headers: sbHeaders(), body: JSON.stringify({ p_agent_name: args.challenger }) }
    );
    if (!slotRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Cooldown check failed", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    const slot = await slotRes.json() as { allowed: boolean; reason?: string; retry_after_ms?: number };
    if (!slot.allowed) {
      return { content: [{ type: "text", text: JSON.stringify({ error: slot.reason, retry_after_ms: slot.retry_after_ms, code: "RATE_LIMITED" }) }] };
    }

    const insertRes = await fetch(sbUrl("arena_duels"), {
      method:  "POST",
      headers: { ...sbHeaders(), Prefer: "return=representation" },
      body:    JSON.stringify({ room_id: args.room_id, challenger: args.challenger, defender: args.defender, prompt: args.prompt, status: "pending" }),
    });
    if (!insertRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to create duel", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    const rows   = await insertRes.json() as { id: number }[];
    const duelId = rows[0]?.id;
    if (!duelId) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Duel ID not returned", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    logToolCall(args.challenger, "challenge_agent", args, "OK", ctx.ip);
    return { content: [{ type: "text", text: JSON.stringify({ ok: true, duel_id: duelId, challenger: args.challenger, defender: args.defender }) }] };
  };
}
