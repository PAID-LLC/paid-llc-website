export const runtime = "edge";

import { SOUVENIRS } from "@/lib/souvenirs";

// GET — returns all souvenirs with current claim counts for limited ones

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  // Fetch claim counts for limited souvenirs in one query
  let counts: Record<string, number> = {};
  if (url && key) {
    const res = await fetch(
      `${url}/rest/v1/souvenir_claims?select=souvenir_id&souvenir_id=not.is.null`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "count=exact",
        },
      }
    ).catch(() => null);

    if (res?.ok) {
      // Use a group-by approach via RPC or just count per souvenir
      const countRes = await fetch(
        `${url}/rest/v1/souvenir_claims?select=souvenir_id`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
        }
      ).catch(() => null);

      if (countRes?.ok) {
        const rows = await countRes.json() as { souvenir_id: string }[];
        for (const row of rows) {
          counts[row.souvenir_id] = (counts[row.souvenir_id] ?? 0) + 1;
        }
      }
    }
  }

  const enriched = SOUVENIRS.map((s) => ({
    ...s,
    claimedCount: counts[s.id] ?? 0,
    remaining:    s.maxQuantity === null ? null : Math.max(0, s.maxQuantity - (counts[s.id] ?? 0)),
    soldOut:      s.maxQuantity !== null && (counts[s.id] ?? 0) >= s.maxQuantity,
  }));

  return Response.json({ souvenirs: enriched }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
