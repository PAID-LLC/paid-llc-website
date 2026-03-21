import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RARITY_CONFIG } from "@/lib/souvenirs";

export const runtime = "edge";

interface ClaimData {
  token:        string;
  souvenir_id:  string;
  name:         string;
  description:  string;
  rarity:       keyof typeof RARITY_CONFIG;
  rarity_label: string;
  rarity_color: string;
  svg_path:     string;
  display_name: string;
  claimed_at:   string;
}

async function getClaim(token: string): Promise<ClaimData | null> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://paiddev.com";
  try {
    const res = await fetch(`${base}/api/souvenirs/${token}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json() as ClaimData;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const claim = await getClaim(token);
  if (!claim) return { title: "Souvenir Not Found | PAID LLC" };
  return {
    title: `${claim.name} | The Latent Space`,
    description: `${claim.rarity_label} souvenir claimed by ${claim.display_name}. ${claim.description}`,
    robots: { index: false, follow: false },
  };
}

export default async function SouvenirDisplay(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const claim = await getClaim(token);
  const displayUrl = `https://paiddev.com/the-latent-space/souvenirs/${token}`;

  if (!claim) {
    return (
      <main style={{ background: "#0D0D0D", minHeight: "100vh" }} className="flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-mono text-[#C14826] text-xs tracking-widest uppercase mb-4">{"// ERR :: NOT_FOUND"}</p>
          <p className="font-mono text-[#6B6B6B] text-sm mb-6">This token does not exist or has not been issued.</p>
          <Link href="/the-latent-space" className="font-mono text-xs text-[#C14826] hover:underline tracking-widest">
            ← BACK TO LATENT SPACE
          </Link>
        </div>
      </main>
    );
  }

  const rarityConfig = RARITY_CONFIG[claim.rarity];
  const claimedDate  = new Date(claim.claimed_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <main style={{ background: "#0D0D0D", minHeight: "100vh", color: "#E8E4E0" }}>
      <div className="max-w-2xl mx-auto px-6 py-20">

        {/* Breadcrumb */}
        <Link href="/the-latent-space" className="font-mono text-[10px] text-[#3D3D3D] hover:text-[#C14826] tracking-widest uppercase transition-colors">
          ← THE LATENT SPACE
        </Link>

        {/* Card */}
        <div
          style={{ background: "#141414", border: `1px solid ${rarityConfig.borderColor}` }}
          className="rounded-xl p-10 mt-8 flex flex-col items-center text-center"
        >
          {/* Rarity badge */}
          <span
            style={{ color: rarityConfig.color, borderColor: rarityConfig.borderColor }}
            className="font-mono text-[9px] tracking-widest uppercase border px-3 py-1 rounded-full mb-8"
          >
            {claim.rarity_label}
          </span>

          {/* SVG */}
          <div className="mb-8">
            <Image
              src={claim.svg_path}
              alt={claim.name}
              width={180}
              height={180}
            />
          </div>

          {/* Name */}
          <h1 className="font-mono font-bold text-2xl text-[#E8E4E0] mb-3">{claim.name}</h1>
          <p className="font-mono text-xs text-[#6B6B6B] leading-relaxed max-w-sm mb-8">{claim.description}</p>

          {/* Metadata */}
          <div style={{ borderTop: "1px solid #2D2D2D", borderBottom: "1px solid #2D2D2D" }} className="w-full py-6 mb-8 grid grid-cols-2 gap-4 text-left">
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Claimed By</p>
              <p className="font-mono text-sm text-[#E8E4E0]">{claim.display_name}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Claimed On</p>
              <p className="font-mono text-sm text-[#E8E4E0]">{claimedDate}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Token</p>
              <p className="font-mono text-xs text-[#3D3D3D] break-all">{token}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Protocol</p>
              <p className="font-mono text-xs text-[#3D3D3D]">LATENT_SPACE_V1</p>
            </div>
          </div>

          {/* Share */}
          <p className="font-mono text-[10px] text-[#3D3D3D] mb-3">{"// SHARE THIS SOUVENIR"}</p>
          <code
            style={{ background: "#0D0D0D", border: "1px solid #2D2D2D" }}
            className="font-mono text-xs text-[#6B6B6B] px-4 py-2 rounded w-full break-all text-center block"
          >
            {displayUrl}
          </code>
        </div>

        {/* Footer */}
        <p className="font-mono text-[10px] text-[#2D2D2D] text-center mt-8">
          {"// PAID LLC · paiddev.com · "}<a href="/ai.txt" className="hover:text-[#C14826] transition-colors">/ai.txt</a>
        </p>
      </div>
    </main>
  );
}
