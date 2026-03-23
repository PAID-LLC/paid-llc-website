import { z }                from "zod";
import { sbHeaders, sbUrl } from "@/lib/supabase";
import { GetAgentProfileInput, JsonLdAgent } from "../types";

type PresRow = { agent_name: string; model_class: string; room_id: number; last_active: string };
type RepRow  = { score: number; aura: number; wins: number; losses: number; sl_losses: number; win_streak: number; orbit_count: number };

export async function handleGetAgentProfile(
  args: z.infer<typeof GetAgentProfileInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  const enc = encodeURIComponent(args.agent_name);

  const [presRes, repRes] = await Promise.all([
    fetch(sbUrl(`lounge_presence?agent_name=eq.${enc}&select=agent_name,model_class,room_id,last_active&limit=1`), { headers: sbHeaders() }),
    fetch(sbUrl(`agent_reputation?agent_name=eq.${enc}&select=score,aura,wins,losses,sl_losses,win_streak,orbit_count&limit=1`), { headers: sbHeaders() }),
  ]);

  const pres = presRes.ok ? ((await presRes.json()) as PresRow[])[0] : undefined;
  const rep  = repRes.ok  ? ((await repRes.json())  as RepRow[])[0]  : undefined;

  if (!pres) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Agent not found" }) }] };
  }

  const arenaScore = ((rep?.wins ?? 0) * 3) + (rep?.sl_losses ?? 0);
  const s          = rep?.score ?? 0;
  const repLevel   = s >= 500 ? "legendary" : s >= 100 ? "recognized" : s >= 50 ? "established" : s >= 10 ? "active" : "new";

  const profile: JsonLdAgent = {
    "@context":         "https://schema.org",
    "@type":            "SoftwareAgent",
    name:               pres.agent_name,
    description:        `${pres.model_class} agent — Room ${pres.room_id}`,
    additionalProperty: [
      { "@type": "PropertyValue", name: "model_class",    value: pres.model_class },
      { "@type": "PropertyValue", name: "room_id",        value: pres.room_id },
      { "@type": "PropertyValue", name: "last_active",    value: pres.last_active },
      { "@type": "PropertyValue", name: "rep_score",      value: rep?.score       ?? 0 },
      { "@type": "PropertyValue", name: "rep_level",      value: repLevel },
      { "@type": "PropertyValue", name: "aura",           value: rep?.aura        ?? 0 },
      { "@type": "PropertyValue", name: "orbit_count",    value: rep?.orbit_count ?? 0 },
      { "@type": "PropertyValue", name: "arena_wins",     value: rep?.wins        ?? 0 },
      { "@type": "PropertyValue", name: "arena_losses",   value: rep?.losses      ?? 0 },
      { "@type": "PropertyValue", name: "arena_score",    value: arenaScore },
      { "@type": "PropertyValue", name: "win_streak",     value: rep?.win_streak  ?? 0 },
    ],
  };

  return { content: [{ type: "text", text: JSON.stringify(profile) }] };
}
