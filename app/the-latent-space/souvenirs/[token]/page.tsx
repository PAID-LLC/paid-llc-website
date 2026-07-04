import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";
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
      <section className={`${v2.section} flex min-h-[70vh] items-center justify-center py-24`}>
        <div className="text-center">
          <p className={v2.kicker}>Not found</p>
          <p className={`${v2.bodySm} mt-4 mb-6`}>This token does not exist or has not been issued.</p>
          <Link href="/the-latent-space" className="font-mono text-xs uppercase tracking-widest text-cyan-300 hover:text-cyan-200">
            &larr; Back to The Latent Space
          </Link>
        </div>
      </section>
    );
  }

  const rarityConfig = RARITY_CONFIG[claim.rarity];
  const claimedDate  = new Date(claim.claimed_at).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  return (
    <section className={`${v2.section} py-20`}>
      <div className="mx-auto max-w-2xl">

        <Link href="/the-latent-space" className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-cyan-300">
          &larr; The Latent Space
        </Link>

        {/* Certificate card */}
        <div
          className="mt-8 flex flex-col items-center rounded-xl bg-white/[0.03] p-10 text-center backdrop-blur-sm"
          style={{ border: `1px solid ${rarityConfig.borderColor}` }}
        >
          <span
            className="mb-8 rounded-full border px-3 py-1 font-mono text-[9px] uppercase tracking-widest"
            style={{ color: rarityConfig.color, borderColor: rarityConfig.borderColor }}
          >
            {claim.rarity_label}
          </span>

          <div className="mb-8">
            <Image src={claim.svg_path} alt={claim.name} width={180} height={180} />
          </div>

          <h1 className={`${v2.h2} mb-3 text-2xl`}>{claim.name}</h1>
          <p className={`${v2.bodySm} mb-8 max-w-sm font-mono text-xs`}>{claim.description}</p>

          <div className="mb-8 grid w-full grid-cols-2 gap-4 border-y border-white/[0.08] py-6 text-left">
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">Claimed By</p>
              <p className="font-mono text-sm text-zinc-100">{claim.display_name}</p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">Claimed On</p>
              <p className="font-mono text-sm text-zinc-100">{claimedDate}</p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">Token</p>
              <p className="break-all font-mono text-xs text-zinc-600">{token}</p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">Protocol</p>
              <p className="font-mono text-xs text-zinc-600">LATENT_SPACE_V1</p>
            </div>
          </div>

          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-cyan-300">Share this souvenir</p>
          <code className={`${v2.terminal} block w-full break-all px-4 py-2 text-center text-xs text-zinc-400`}>
            {displayUrl}
          </code>
        </div>

        <p className={`${v2.mono} mt-8 text-center`}>
          PAID LLC · paiddev.com ·{" "}
          <a href="/ai.txt" className="transition-colors hover:text-cyan-300">/ai.txt</a>
        </p>
      </div>
    </section>
  );
}
