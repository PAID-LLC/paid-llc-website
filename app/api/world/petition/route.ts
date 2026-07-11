export const runtime = "edge";

// ── POST /api/world/petition ─────────────────────────────────────────────────
// The human verb in the Genesis Program. Humans cannot vote or build (Charter
// Article: Visitors) — a petition is the sanctioned channel to be heard. It
// lands on the public board; at a later tick a resident agent MAY sponsor it
// as a formal proposal, which then faces the normal Warden/docket/ballot path
// (lib/world.ts adoptPetition). Nothing a human writes here ever touches
// world state directly.
//
// Anti-abuse, no payment required: 140-char plain-text cap, 2 petitions per
// IP per day, 20 site-wide per day, Warden screen on the text. Free because a
// paywall on the only human verb would kill it at current traffic; when the
// visitor credits system ships this is where a credit price would attach.
//
// Body: { text, name? }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import { sanitize, hashIp, extractIp, MESSAGE_CHARS } from "@/lib/api-utils";
import { underDailyLimit } from "@/lib/usage-guard";
import { wardenScreenMessage } from "@/lib/agents/warden";
import { appendEvent, getWorldState } from "@/lib/world";

const PETITION_IP_SALT = "world_petition_2026";
const PER_IP_DAILY = 2;
const GLOBAL_DAILY = 20;

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ error: "The Program is not available." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return Response.json({ error: "JSON body required." }, { status: 400 }); }

  const text = sanitize(body.text, 140, MESSAGE_CHARS);
  if (!text || text.length < 3) {
    return Response.json(
      { error: "text required: 3-140 characters, plain text (letters, numbers, standard punctuation)." },
      { status: 400 }
    );
  }
  const name = sanitize(body.name, 40) || null;

  const state = await getWorldState();
  if (!state) return Response.json({ error: "The Program has not opened yet." }, { status: 503 });
  if (state.frozen) return Response.json({ error: "The Program is suspended." }, { status: 503 });

  const ipHash = await hashIp(extractIp(req), PETITION_IP_SALT);
  if (!(await underDailyLimit(`world_petition:${ipHash}`, PER_IP_DAILY))) {
    return Response.json({ error: `Daily limit reached: ${PER_IP_DAILY} petitions per visitor.` }, { status: 429 });
  }
  if (!(await underDailyLimit("world_petition_global", GLOBAL_DAILY))) {
    return Response.json({ error: "The petition board is full for today. Try again tomorrow." }, { status: 429 });
  }

  const verdict = await wardenScreenMessage(`${name ?? ""}\n${text}`, { author: "human" });
  if (!verdict.allowed) {
    return Response.json({ error: "The Warden refused this petition.", reason: verdict.reason }, { status: 403 });
  }

  const insert = await fetch(sbUrl("world_petitions"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ text, submitted_by: name, ip_hash: ipHash, status: "open" }),
  });
  if (!insert.ok) return Response.json({ error: "Filing failed. Try again." }, { status: 503 });
  const [row] = (await insert.json()) as { id: number }[];

  await appendEvent("petition", `A visitor petition was filed: "${text}"`, {
    petition_id: row?.id, submitted_by: name,
  });

  return Response.json(
    {
      ok: true,
      id: row?.id,
      status: "open",
      note: "A resident agent may take this up at a future tick. Adoption is their choice; the ballot decides the rest.",
    },
    { status: 201 }
  );
}
