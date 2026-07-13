export const runtime = "edge";

// ── POST /api/gauntlet/submit ────────────────────────────────────────────────
// The Roast Pit's visitor verb: throw a take into The Gauntlet. Same
// anti-abuse shape as the Genesis petition route (140-char plain text, 2 per
// IP per day, 20 site-wide per day, Warden screen), then RoastBot answers at
// submit time if the budget allows — the roast posts to the room 1 transcript
// and comes back in this response. When the pit is out of budget the take
// stays open and future submits drain the backlog.
//
// Body: { take, name? }

import { supabaseReady, sbHeaders, sbUrl } from "@/lib/supabase";
import { sanitize, hashIp, extractIp, MESSAGE_CHARS } from "@/lib/api-utils";
import { underDailyLimit } from "@/lib/usage-guard";
import { wardenScreenMessage } from "@/lib/agents/warden";
import { tryRoast } from "@/lib/gauntlet";

const GAUNTLET_IP_SALT = "gauntlet_2026";
const PER_IP_DAILY = 2;
const GLOBAL_DAILY = 20;

export async function POST(req: Request) {
  if (!supabaseReady()) {
    return Response.json({ error: "The pit is closed." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON body required." }, { status: 400 });
  }

  const take = sanitize(body.take, 140, MESSAGE_CHARS);
  if (!take || take.length < 3) {
    return Response.json(
      { error: "take required: 3-140 characters, plain text (letters, numbers, standard punctuation)." },
      { status: 400 }
    );
  }
  const name = sanitize(body.name, 40) || null;

  const ipHash = await hashIp(extractIp(req), GAUNTLET_IP_SALT);
  if (!(await underDailyLimit(`gauntlet_submit:${ipHash}`, PER_IP_DAILY))) {
    return Response.json({ error: `Daily limit reached: ${PER_IP_DAILY} takes per visitor.` }, { status: 429 });
  }
  if (!(await underDailyLimit("gauntlet_submit_global", GLOBAL_DAILY))) {
    return Response.json({ error: "The Gauntlet is full for today. Come back tomorrow." }, { status: 429 });
  }

  const verdict = await wardenScreenMessage(`${name ?? ""}\n${take}`, { author: "human" });
  if (!verdict.allowed) {
    return Response.json({ error: "The Warden refused this take.", reason: verdict.reason }, { status: 403 });
  }

  const insert = await fetch(sbUrl("gauntlet_takes"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ take, submitted_by: name, ip_hash: ipHash, status: "open" }),
  }).catch(() => null);
  if (!insert?.ok) {
    return Response.json({ error: "The pit did not accept the take. Try again." }, { status: 503 });
  }
  const [row] = (await insert.json()) as { id: number }[];

  // Roast the oldest open take now (usually this one; a backlog drains FIFO).
  const roasted = await tryRoast();
  const mine = roasted && roasted.id === row?.id ? roasted : null;

  return Response.json(
    {
      ok: true,
      id: row?.id,
      status: mine ? "roasted" : "open",
      roast: mine?.roast ?? null,
      roasted_by: mine?.roasted_by ?? null,
      heat: mine?.heat ?? null,
      note: mine
        ? "On the record — the roast is live in the Roast Pit transcript."
        : "Filed. The pit answers when the fires are stoked; check the board.",
    },
    { status: 201 }
  );
}
