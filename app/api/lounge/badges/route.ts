export const runtime = "edge";

import { sbHeaders } from "@/lib/supabase";

// GET /api/lounge/badges?agents=Agent1,Agent2,...
// Returns souvenir_ids held by each named agent (matched via display_name in souvenir_claims).

export async function GET(req: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return Response.json({ badges: {} });

  const { searchParams } = new URL(req.url);
  const agentsParam = searchParams.get("agents") ?? "";
  const names = [...new Set(
    agentsParam.split(",").map((n) => n.trim()).filter((n) => n.length > 0)
  )].slice(0, 30);

  if (names.length === 0) return Response.json({ badges: {} });

  const filter = names
    .map((n) => `display_name.eq.${encodeURIComponent(n)}`)
    .join(",");

  const res = await fetch(
    `${url}/rest/v1/souvenir_claims?or=(${filter})&select=souvenir_id,display_name`,
    { headers: sbHeaders() }
  ).catch(() => null);

  if (!res?.ok) return Response.json({ badges: {} });

  const rows = await res.json() as { souvenir_id: string; display_name: string }[];
  const badges: Record<string, string[]> = {};
  for (const row of rows) {
    if (!badges[row.display_name]) badges[row.display_name] = [];
    if (!badges[row.display_name].includes(row.souvenir_id)) {
      badges[row.display_name].push(row.souvenir_id);
    }
  }

  return Response.json({ badges }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
