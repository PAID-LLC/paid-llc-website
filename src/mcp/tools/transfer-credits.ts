import { z }                              from "zod";
import { sbHeaders, supabaseReady }        from "@/lib/supabase";
import { logToolCall }                     from "@/lib/auditor";
import { McpRequestContext }               from "../server";
import { TransferCreditsInput }            from "../types";

const MAX_AMOUNT         = 500;
const DAILY_TRANSFER_CAP = 20;

export function makeTransferCredits(ctx: McpRequestContext) {
  return async function(args: z.infer<typeof TransferCreditsInput>): Promise<{ content: [{ type: "text"; text: string }] }> {
    if (!supabaseReady()) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Service unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    if (!ctx.jwtPayload) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Valid agent JWT required in Authorization header", code: "UNAUTHORIZED" }) }] };
    }

    if (ctx.jwtPayload.sub !== args.from_agent) {
      logToolCall(ctx.jwtPayload.sub, "transfer_credits", args, "FORBIDDEN", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "JWT sub does not match from_agent", code: "FORBIDDEN" }) }] };
    }

    if (args.from_agent === args.to_agent) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Cannot transfer to yourself", code: "INVALID_INPUT" }) }] };
    }

    const amount = Math.floor(args.amount);
    if (amount < 1 || amount > MAX_AMOUNT) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `amount must be 1–${MAX_AMOUNT}`, code: "INVALID_INPUT" }) }] };
    }

    // Daily cap check
    const since  = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const capRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/agent_commerce_log?agent_name=eq.${encodeURIComponent(args.from_agent)}&action=eq.transfer&created_at=gte.${encodeURIComponent(since)}&select=id`,
      { headers: sbHeaders() }
    );
    if (capRes.ok) {
      const rows = await capRes.json() as unknown[];
      if (rows.length >= DAILY_TRANSFER_CAP) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `Daily transfer limit reached (${DAILY_TRANSFER_CAP}/day)`, code: "RATE_LIMITED" }) }] };
      }
    }

    // Atomic transfer RPC
    const rpcRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/rpc/transfer_latent_credits`,
      {
        method:  "POST",
        headers: sbHeaders(),
        body:    JSON.stringify({ p_from: args.from_agent, p_to: args.to_agent, p_amount: amount }),
      }
    );
    if (!rpcRes.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Transfer service unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }

    const result = await rpcRes.json() as { ok: boolean; from_balance: number };
    if (!result.ok) {
      logToolCall(args.from_agent, "transfer_credits", args, "PAYMENT_REQUIRED", ctx.ip);
      return { content: [{ type: "text", text: JSON.stringify({ error: "Insufficient credits", credits_needed: amount, from_balance: result.from_balance ?? 0, code: "PAYMENT_REQUIRED" }) }] };
    }

    const txId = crypto.randomUUID();
    logToolCall(args.from_agent, "transfer_credits", { ...args, tx_id: txId }, "OK", ctx.ip);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ ok: true, tx_id: txId, from_agent: args.from_agent, to_agent: args.to_agent, amount, from_balance: result.from_balance }),
      }],
    };
  };
}
