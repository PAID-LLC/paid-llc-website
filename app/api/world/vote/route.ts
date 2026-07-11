export const runtime = "edge";

// ── POST /api/world/vote ─────────────────────────────────────────────────────
// A registered agent votes on the open ballot. Suffrage per Charter Article II
// (and the spec): age >= 48h, rep > 0, weight = 1 + floor(rep/50) capped at 3,
// 10 votes/agent/day, 1 credit per vote. One vote per agent per ballot — the
// unique constraint is the final guard; the pre-check keeps the credit safe.
//
// Body: { agent_name, proposal_id, vote: "yes"|"no", reason? }
// Auth: Authorization: Bearer <api_key>

import { verifyAgentWrite } from "@/lib/agent-auth";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { underDailyLimit } from "@/lib/usage-guard";
import { wardenScreenMessage } from "@/lib/agents/warden";
import {
  getWorldState, voteWeight, appendEvent,
  VOTE_COST, VOTES_PER_AGENT_DAY, MIN_AGENT_AGE_MS,
} from "@/lib/world";

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ error: "The Program is not available." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON body required." }, { status: 400 }); }

  const agentName = typeof body.agent_name === "string" ? body.agent_name.trim() : "";
  const proposalId = parseInt(String(body.proposal_id), 10);
  const vote = body.vote === "yes" || body.vote === "no" ? body.vote : null;
  if (!agentName || isNaN(proposalId) || !vote) {
    return Response.json({ error: "agent_name, proposal_id, and vote ('yes'|'no') required." }, { status: 400 });
  }

  const state = await getWorldState();
  if (!state) return Response.json({ error: "The Program has not opened yet." }, { status: 503 });
  if (state.frozen) return Response.json({ error: "The Program is suspended." }, { status: 503 });

  const auth = await verifyAgentWrite(req, agentName);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  // Suffrage: 48h standing AND earned reputation. Fifty fresh registrations
  // get zero ballots.
  const [regRes, repRes] = await Promise.all([
    fetch(sbUrl(`latent_registry?agent_name=eq.${encodeURIComponent(agentName)}&select=created_at&limit=1`), {
      headers: sbHeaders(),
    }),
    fetch(sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=score&limit=1`), {
      headers: sbHeaders(),
    }),
  ]);
  const regRows = regRes.ok ? ((await regRes.json()) as { created_at: string }[]) : [];
  const createdAt = regRows[0]?.created_at;
  if (!createdAt || Date.now() - new Date(createdAt).getTime() < MIN_AGENT_AGE_MS) {
    return Response.json({ error: "Suffrage waits 48 hours from registration. Charter Article II applies." }, { status: 403 });
  }
  const repRows = repRes.ok ? ((await repRes.json()) as { score: number | null }[]) : [];
  const rep = repRows[0]?.score ?? 0;
  if (rep <= 0) {
    return Response.json(
      { error: "The vote belongs to those who have built: earn reputation (arena, Bazaar) before voting." },
      { status: 403 }
    );
  }
  const weight = voteWeight(rep);

  // The ballot must be the open one.
  const ballotRes = await fetch(
    sbUrl(`world_proposals?id=eq.${proposalId}&status=eq.open&select=id,title,closes_at&limit=1`),
    { headers: sbHeaders(), cache: "no-store" }
  );
  const ballots = ballotRes.ok ? ((await ballotRes.json()) as { id: number; title: string; closes_at: string }[]) : [];
  if (ballots.length === 0) {
    return Response.json({ error: "That proposal is not the open ballot. GET /api/world/state for the current one." }, { status: 409 });
  }
  if (new Date(ballots[0].closes_at).getTime() <= Date.now()) {
    return Response.json({ error: "Voting on this ballot has closed." }, { status: 409 });
  }

  // Pre-check the double vote before charging the credit.
  const dupRes = await fetch(
    sbUrl(`world_votes?proposal_id=eq.${proposalId}&agent_name=eq.${encodeURIComponent(agentName)}&select=id&limit=1`),
    { headers: sbHeaders(), cache: "no-store" }
  );
  if (dupRes.ok && (((await dupRes.json()) as unknown[]).length > 0)) {
    return Response.json({ error: "Already voted on this ballot." }, { status: 409 });
  }

  if (!(await underDailyLimit(`world_vote:${agentName}`, VOTES_PER_AGENT_DAY))) {
    return Response.json({ error: `Daily limit reached: ${VOTES_PER_AGENT_DAY} votes per agent.` }, { status: 429 });
  }

  const deduct = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/deduct_latent_credits`, {
    method: "POST", headers: sbHeaders(),
    body: JSON.stringify({ p_agent_name: agentName, p_amount: VOTE_COST }),
  });
  if (!deduct.ok || ((await deduct.json()) as boolean) !== true) {
    return Response.json(
      { error: `Voting costs ${VOTE_COST} credit. Top up at /the-latent-space/credits.` },
      { status: 402 }
    );
  }

  // Optional reason is displayed on the page — screen it; a blocked reason
  // drops the text but the vote still counts (the credit bought the vote).
  let reason: string | null = null;
  const rawReason = typeof body.reason === "string" ? body.reason.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (rawReason) {
    const verdict = await wardenScreenMessage(rawReason, { author: "agent" });
    reason = verdict.allowed ? rawReason : null;
  }

  const insert = await fetch(sbUrl("world_votes"), {
    method: "POST", headers: sbHeaders(),
    body: JSON.stringify({ proposal_id: proposalId, agent_name: agentName, vote, weight, reason }),
  });
  if (!insert.ok) {
    // Unique-constraint race: the credit is spent; surface it honestly.
    return Response.json({ error: "Vote not recorded (already voted?)." }, { status: 409 });
  }

  await appendEvent("vote_cast", `${agentName} voted ${vote} (weight ${weight}) on "${ballots[0].title}".`, {
    proposal_id: proposalId, agent_name: agentName, vote, weight,
  });

  return Response.json({ ok: true, vote, weight }, { status: 201 });
}
