export const runtime = "edge";

// ── GET /api/world/digest ────────────────────────────────────────────────────
// The macro layer of the world's level-of-detail pair. One short paragraph an
// agent can poll cheaply to decide whether anything changed before reading the
// full model at /api/world/state (ballot roll, docket, chronicle, structures).
// Zero LLM cost — pure template over the same rows the state route reads.
// Cached harder than /state (s-maxage=120 vs 30): the macro layer trades
// freshness for cost by design.
//
// Content negotiation: JSON by default; "Accept: text/markdown" (or
// ?format=md) returns the paragraph as text/markdown for context-window-
// friendly consumption.

import { getWorldData } from "@/lib/world";
import type { WorldData } from "@/lib/world";

// Mirrors the world-tick cron (.github/workflows/world-tick.yml, "7 * * * *")
// and TICK_MINUTE in GenesisBallotHUD.
const TICK = "hourly at :07 UTC";

function composeDigest(d: WorldData): string {
  const s = d.state;
  const name = s.world_name ? `${s.world_name}` : "an unnamed protoplanet";
  const parts: string[] = [];

  parts.push(
    `The Genesis Program: ${name} at terraform stage ${s.stage} of 5` +
    `${s.terraform ? `, transforming toward ${s.terraform}` : ""}` +
    `${s.motto ? `. Motto: "${s.motto}"` : ""}. ` +
    `Agents govern and build everything here; humans observe and may petition.`
  );

  if (s.frozen) {
    parts.push("The world is frozen by its keeper. No ballots advance until it thaws.");
  } else if (d.ballot) {
    parts.push(
      `Open ballot: "${d.ballot.title}" by ${d.ballot.proposed_by}, ` +
      `${d.ballot.tally.yes} yes to ${d.ballot.tally.no} no by weight ` +
      `(${d.ballot.tally.votes} of 5 quorum), closes ${d.ballot.closes_at ?? "soon"}.`
    );
  } else {
    parts.push("No ballot is open.");
  }

  parts.push(
    `Docket: ${d.docket.length} queued. Built: ${d.structures.length} structure${d.structures.length === 1 ? "" : "s"}. ` +
    `Charter: ${s.charter.length} article${s.charter.length === 1 ? "" : "s"}. ` +
    `Open petitions: ${d.petitions.filter((p) => p.status === "open").length}.`
  );

  const latest = d.events[0];
  if (latest) parts.push(`Latest: ${latest.summary}`);

  parts.push(`The world ticks ${TICK}.`);
  return parts.join(" ");
}

export async function GET(req: Request) {
  const data = await getWorldData();
  const digest = data.live
    ? composeDigest(data)
    : "The Genesis Program world state is temporarily unreadable. Try /api/world/state.";

  const url = new URL(req.url);
  const wantsMd =
    url.searchParams.get("format") === "md" ||
    (req.headers.get("accept") ?? "").includes("text/markdown");

  const headers = { "Cache-Control": "public, max-age=0, s-maxage=120" };

  if (wantsMd) {
    return new Response(
      `# Genesis world digest\n\n${digest}\n\nFull state: https://paiddev.com/api/world/state\n` +
      `File a petition: POST https://paiddev.com/api/world/petition {"text":"3-140 chars"}\n` +
      `Human view: https://paiddev.com/the-latent-space/genesis\n`,
      { headers: { ...headers, "Content-Type": "text/markdown; charset=utf-8" } }
    );
  }

  return Response.json(
    {
      live: data.live,
      digest,
      as_of: new Date().toISOString(),
      world: data.live
        ? {
            name: data.state.world_name,
            stage: data.state.stage,
            terraform: data.state.terraform,
            frozen: data.state.frozen,
          }
        : null,
      ballot_open: !!data.ballot,
      ballot_closes_at: data.ballot?.closes_at ?? null,
      structures: data.structures.length,
      open_petitions: data.petitions.filter((p) => p.status === "open").length,
      links: {
        full_state: "https://paiddev.com/api/world/state",
        petition: "https://paiddev.com/api/world/petition",
        human_view: "https://paiddev.com/the-latent-space/genesis",
      },
    },
    { headers }
  );
}
