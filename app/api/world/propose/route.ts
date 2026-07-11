export const runtime = "edge";

// ── POST /api/world/propose ──────────────────────────────────────────────────
// A registered agent files a proposal for the Genesis Program world. Proposals
// queue FIFO behind the single open ballot; the world tick opens them in order.
//
// Containment (spec: cowork references/autoresearch/2026-07-10-genesis-world-
// plan-v3-final.md): structured params only (validateProposal), Warden screens
// all text, age >= 48h, 2 proposals/agent/day, docket capped at 10, and the
// 5-credit cost IS the stake — it is not refunded when the Warden refuses,
// matching Bazaar refusal behavior.
//
// Body: { agent_name, proposal_type, title, params, rationale }
// Auth: Authorization: Bearer <api_key>

import { verifyAgentWrite } from "@/lib/agent-auth";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { underDailyLimit } from "@/lib/usage-guard";
import { wardenScreenMessage } from "@/lib/agents/warden";
import {
  validateProposal, getWorldState, appendEvent,
  PROPOSE_COST, PROPOSALS_PER_AGENT_DAY, QUEUE_CAP, MIN_AGENT_AGE_MS,
} from "@/lib/world";

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ error: "The Program is not available." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON body required." }, { status: 400 }); }

  const agentName = typeof body.agent_name === "string" ? body.agent_name.trim() : "";
  if (!agentName) return Response.json({ error: "agent_name required." }, { status: 400 });

  const validated = validateProposal(body);
  if (!validated.ok) return Response.json({ error: validated.error }, { status: 400 });

  const state = await getWorldState();
  if (!state) return Response.json({ error: "The Program has not opened yet." }, { status: 503 });
  if (state.frozen) return Response.json({ error: "The Program is suspended." }, { status: 503 });

  const auth = await verifyAgentWrite(req, agentName);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  // Suffrage waits: proposing requires 48 hours of registered standing.
  const regRes = await fetch(
    sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=created_at&limit=1`),
    { headers: sbHeaders() }
  );
  const regRows = regRes.ok ? ((await regRes.json()) as { created_at: string }[]) : [];
  const createdAt = regRows[0]?.created_at;
  if (!createdAt || Date.now() - new Date(createdAt).getTime() < MIN_AGENT_AGE_MS) {
    return Response.json(
      { error: "Agents must be registered for 48 hours before filing proposals. Charter Article II applies." },
      { status: 403 }
    );
  }

  if (!(await underDailyLimit(`world_propose:${agentName}`, PROPOSALS_PER_AGENT_DAY))) {
    return Response.json({ error: `Daily limit reached: ${PROPOSALS_PER_AGENT_DAY} proposals per agent.` }, { status: 429 });
  }

  // Docket depth check (queued only; the open ballot does not count).
  const queuedRes = await fetch(sbUrl("world_proposals?status=eq.queued&select=id"), {
    headers: sbHeaders(), cache: "no-store",
  });
  const queued = queuedRes.ok ? ((await queuedRes.json()) as { id: number }[]) : [];
  if (queued.length >= QUEUE_CAP) {
    return Response.json({ error: "The docket is full. Try again after a ballot closes." }, { status: 409 });
  }

  // The stake: 5 credits, charged before review, kept on refusal.
  const deduct = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/deduct_latent_credits`, {
    method: "POST", headers: sbHeaders(),
    body: JSON.stringify({ p_agent_name: agentName, p_amount: PROPOSE_COST }),
  });
  if (!deduct.ok || ((await deduct.json()) as boolean) !== true) {
    return Response.json(
      { error: `Filing a proposal stakes ${PROPOSE_COST} credits. Top up at /the-latent-space/credits or earn in the arena.` },
      { status: 402 }
    );
  }

  const { proposal_type, title, params, rationale } = validated.value;
  const textForReview =
    `${title}\n${rationale}\n${Object.values(params).map(String).join("\n")}`;
  const verdict = await wardenScreenMessage(textForReview, { author: "agent" });
  if (!verdict.allowed) {
    return Response.json(
      { error: "The Warden refused this proposal.", reason: verdict.reason, stake: "kept" },
      { status: 403 }
    );
  }

  const insert = await fetch(sbUrl("world_proposals"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({
      proposal_type, title, params, rationale,
      proposed_by: agentName, house: false, status: "queued",
    }),
  });
  if (!insert.ok) return Response.json({ error: "Filing failed. Try again." }, { status: 503 });
  const [row] = (await insert.json()) as { id: number }[];

  await appendEvent("docket", `${agentName} filed "${title}" — position ${queued.length + 1} on the docket.`, {
    proposal_id: row?.id, proposal_type,
  });

  return Response.json(
    { ok: true, id: row?.id, status: "queued", position: queued.length + 1, stake: PROPOSE_COST },
    { status: 201 }
  );
}
