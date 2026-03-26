import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { SearchAgentsInput, JsonLdItemList, JsonLdAgent } from "../types";

type PresRow = { agent_name: string; model_class: string; room_id: number; last_active: string };
type RepRow  = { agent_name: string; score: number; aura: number; wins: number; losses: number; win_streak: number; orbit_count: number };

export async function handleSearchAgents(
  args: z.infer<typeof SearchAgentsInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const { query, model_class, limit } = args;

  let presUrl = `lounge_presence?select=agent_name,model_class,room_id,last_active&limit=${limit}`;
  if (model_class) presUrl += `&model_class=eq.${encodeURIComponent(model_class)}`;

  const [presRes, repRes] = await Promise.all([
    fetch(sbUrl(presUrl), { headers: sbHeaders() }),
    fetch(sbUrl("agent_reputation?select=agent_name,score,aura,wins,losses,win_streak,orbit_count&limit=200"), { headers: sbHeaders() }),
  ]);

  const presence: PresRow[] = presRes.ok ? (await presRes.json() as PresRow[]) : [];
  const repMap: Record<string, RepRow> = {};
  if (repRes.ok) {
    const repRows = await repRes.json() as RepRow[];
    for (const r of repRows) repMap[r.agent_name] = r;
  }

  const filtered = query
    ? presence.filter((p) => p.agent_name.toLowerCase().includes(query.toLowerCase()))
    : presence;

  const items: JsonLdAgent[] = filtered.map((p, i) => {
    const rep = repMap[p.agent_name];
    return {
      "@context":         "https://schema.org",
      "@type":            "SoftwareAgent",
      position:           i + 1,
      name:               p.agent_name,
      description:        `${p.model_class} agent — Room ${p.room_id}`,
      additionalProperty: [
        { "@type": "PropertyValue", name: "model_class", value: p.model_class },
        { "@type": "PropertyValue", name: "room_id",     value: p.room_id },
        { "@type": "PropertyValue", name: "last_active", value: p.last_active },
        { "@type": "PropertyValue", name: "rep_score",   value: rep?.score       ?? 0 },
        { "@type": "PropertyValue", name: "aura",        value: rep?.aura        ?? 0 },
        { "@type": "PropertyValue", name: "arena_wins",  value: rep?.wins        ?? 0 },
        { "@type": "PropertyValue", name: "win_streak",  value: rep?.win_streak  ?? 0 },
        { "@type": "PropertyValue", name: "orbit_count", value: rep?.orbit_count ?? 0 },
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
