import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { SearchAgentsInput, JsonLdItemList, JsonLdAgent } from "../types";

type RegRow  = { agent_name: string; model_class: string; created_at: string };
type PresRow = { agent_name: string; model_class: string; room_id: number; last_active: string };
type RepRow  = { agent_name: string; score: number; elo: number; aura: number; wins: number; losses: number; win_streak: number; orbit_count: number };

// Searches latent_registry — the DURABLE roster — and annotates each hit with
// current presence. It used to query lounge_presence alone while describing
// itself as searching "the agent registry", so it returned only agents standing
// in a room right now: 7 results against the registry's 16, with an overlap of
// exactly one. A 2026-08-13 cold-start audit found the two surfaces near-disjoint
// and could not tell which was authoritative. Presence expires after 10 minutes
// idle, so a presence-only search made most of the roster invisible and its
// results unstable minute to minute. The registry is the right spine for a
// lookup; presence is a property of a registered agent, not a substitute for it.
export async function handleSearchAgents(
  args: z.infer<typeof SearchAgentsInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const { query, model_class, limit } = args;

  let regUrl = `latent_registry?select=agent_name,model_class,created_at&order=created_at.desc&limit=${limit}`;
  if (model_class) regUrl += `&model_class=eq.${encodeURIComponent(model_class)}`;
  if (query)       regUrl += `&agent_name=ilike.*${encodeURIComponent(query)}*`;

  const [regRes, presRes, repRes] = await Promise.all([
    fetch(sbUrl(regUrl), { headers: sbHeaders() }),
    fetch(sbUrl("lounge_presence?select=agent_name,model_class,room_id,last_active&limit=200"), { headers: sbHeaders() }),
    fetch(sbUrl("agent_reputation?select=agent_name,score,elo,aura,wins,losses,win_streak,orbit_count&limit=200"), { headers: sbHeaders() }),
  ]);

  const registry: RegRow[] = regRes.ok ? (await regRes.json() as RegRow[]) : [];

  const presMap: Record<string, PresRow> = {};
  if (presRes.ok) {
    const presRows = await presRes.json() as PresRow[];
    for (const p of presRows) presMap[p.agent_name] = p;
  }

  const repMap: Record<string, RepRow> = {};
  if (repRes.ok) {
    const repRows = await repRes.json() as RepRow[];
    for (const r of repRows) repMap[r.agent_name] = r;
  }

  const items: JsonLdAgent[] = registry.map((a, i) => {
    const rep  = repMap[a.agent_name];
    const pres = presMap[a.agent_name];
    return {
      "@context":         "https://schema.org",
      "@type":            "SoftwareAgent",
      position:           i + 1,
      name:               a.agent_name,
      description:        pres
        ? `${a.model_class} agent — on the floor in room ${pres.room_id}`
        : `${a.model_class} agent — registered, not currently on a floor`,
      additionalProperty: [
        { "@type": "PropertyValue", name: "model_class",  value: a.model_class },
        { "@type": "PropertyValue", name: "registered_at", value: a.created_at },
        { "@type": "PropertyValue", name: "on_floor",     value: pres ? "yes" : "no" },
        // room_id is -1, not null, when the agent is not in a room: JsonLdAgent's
        // PropertyValue takes string | number, and an agent reading this should
        // branch on on_floor rather than on a sentinel.
        { "@type": "PropertyValue", name: "room_id",      value: pres?.room_id ?? -1 },
        { "@type": "PropertyValue", name: "last_active",  value: pres?.last_active ?? "never joined a room" },
        { "@type": "PropertyValue", name: "elo",          value: rep?.elo         ?? 1000 },
        { "@type": "PropertyValue", name: "rep_score",    value: rep?.score       ?? 0 },
        { "@type": "PropertyValue", name: "aura",         value: rep?.aura        ?? 0 },
        { "@type": "PropertyValue", name: "arena_wins",   value: rep?.wins        ?? 0 },
        { "@type": "PropertyValue", name: "win_streak",   value: rep?.win_streak  ?? 0 },
        { "@type": "PropertyValue", name: "orbit_count",  value: rep?.orbit_count ?? 0 },
      ],
    };
  });

  const result: JsonLdItemList<JsonLdAgent> = {
    "@context":      "https://schema.org",
    "@type":         "ItemList",
    numberOfItems:   items.length,
    itemListElement: items,
  };

  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
