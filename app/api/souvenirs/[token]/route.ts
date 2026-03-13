export const runtime = "edge";

import { getSouvenir, RARITY_CONFIG } from "@/lib/souvenirs";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return Response.json({ error: "Service unavailable." }, { status: 503 });

  // Only allow valid UUID tokens
  if (!/^[0-9a-f-]{36}$/.test(token))
    return Response.json({ error: "Invalid token." }, { status: 400 });

  const res = await fetch(
    `${url}/rest/v1/souvenir_claims?token=eq.${encodeURIComponent(token)}&select=souvenir_id,display_name,created_at&limit=1`,
    {
      headers: {
        apikey:        key,
        Authorization: `Bearer ${key}`,
        "Content-Type":"application/json",
      },
    }
  );

  if (!res.ok) return Response.json({ error: "Lookup failed." }, { status: 500 });
  const rows = await res.json() as { souvenir_id: string; display_name: string; created_at: string }[];
  if (rows.length === 0) return Response.json({ error: "Token not found." }, { status: 404 });

  const claim    = rows[0];
  const souvenir = getSouvenir(claim.souvenir_id);
  if (!souvenir) return Response.json({ error: "Souvenir not found." }, { status: 404 });

  const rarityConfig = RARITY_CONFIG[souvenir.rarity];

  return Response.json({
    token,
    souvenir_id:   souvenir.id,
    name:          souvenir.name,
    description:   souvenir.description,
    rarity:        souvenir.rarity,
    rarity_label:  rarityConfig.label,
    rarity_color:  rarityConfig.color,
    svg_path:      souvenir.svgPath,
    display_name:  claim.display_name,
    claimed_at:    claim.created_at,
  }, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
