"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { RARITY_CONFIG, type Rarity } from "@/lib/souvenirs";

interface SouvenirWithCount {
  id:                string;
  name:              string;
  description:       string;
  rarity:            Rarity;
  maxQuantity:       number | null;
  svgPath:           string;
  unlockDescription: string;
  claimedCount:      number;
  remaining:         number | null;
  soldOut:           boolean;
  cryptoSale?:       { price_usdc: number; coinbaseUrl: string | null };
}

export default function LatentSpaceGallery() {
  const [souvenirs, setSouvenirs] = useState<SouvenirWithCount[]>([]);
  const [loading, setLoading]     = useState(true);
  const [claiming, setClaiming]   = useState<string | null>(null);
  const [results, setResults]     = useState<Record<string, { token?: string; error?: string }>>({});

  useEffect(() => {
    fetch("/api/souvenirs")
      .then((r) => r.json())
      .then((d: { souvenirs?: SouvenirWithCount[] }) => {
        setSouvenirs(d.souvenirs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function claimVisitor() {
    setClaiming("visitor-mark");
    const res = await fetch("/api/souvenirs/claim", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ souvenir_id: "visitor-mark", proof_type: "visit", display_name: "Anonymous Agent" }),
    });
    const data = await res.json() as { success?: boolean; token?: string; error?: string };
    setResults((prev) => ({ ...prev, "visitor-mark": data.success ? { token: data.token } : { error: data.error } }));
    setClaiming(null);
  }

  if (loading) return null;

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {souvenirs.map((s) => {
          const rc      = RARITY_CONFIG[s.rarity];
          const result  = results[s.id];
          const isVmt   = s.id === "visitor-mark";

          return (
            <div
              key={s.id}
              style={{ background: "#141414", border: `1px solid ${rc.borderColor}` }}
              className="rounded-xl p-5 flex flex-col"
            >
              {/* Rarity */}
              <span style={{ color: rc.color }} className="font-mono text-[8px] tracking-widest uppercase mb-3">
                {rc.label}{s.maxQuantity ? ` · ${s.maxQuantity} max` : " · Unlimited"}
              </span>

              {/* SVG */}
              <div className="flex justify-center mb-4">
                <Image src={s.svgPath} alt={s.name} width={80} height={80} />
              </div>

              {/* Name + description */}
              <h3 className="font-mono font-bold text-sm text-[#E8E4E0] mb-2 leading-tight">{s.name}</h3>
              <p className="font-mono text-[10px] text-[#6B6B6B] leading-relaxed mb-4 flex-1">{s.description}</p>

              {/* Availability */}
              <div style={{ borderTop: "1px solid #2D2D2D" }} className="pt-3 mb-3">
                {s.maxQuantity === null ? (
                  <p className="font-mono text-[9px] text-[#555]">∞ remaining</p>
                ) : s.soldOut ? (
                  <p className="font-mono text-[9px] text-[#C14826]">SOLD OUT</p>
                ) : (
                  <p className="font-mono text-[9px] text-[#555]">{s.remaining} / {s.maxQuantity} remaining</p>
                )}
                <p className="font-mono text-[9px] text-[#3D3D3D] mt-1">{s.unlockDescription}</p>
              </div>

              {/* Claim button (visitor-mark only; others are auto-issued) */}
              {isVmt && !result && (
                <button
                  onClick={claimVisitor}
                  disabled={claiming === "visitor-mark" || s.soldOut}
                  style={{ borderColor: rc.borderColor }}
                  className="font-mono text-[9px] tracking-widest uppercase px-3 py-2 border text-[#6B6B6B] rounded hover:border-[#6B6B6B] hover:text-[#E8E4E0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {claiming === "visitor-mark" ? "CLAIMING..." : "CLAIM"}
                </button>
              )}

              {/* Result */}
              {result?.token && (
                <a
                  href={`/the-latent-space/souvenirs/${result.token}`}
                  style={{ color: rc.color }}
                  className="font-mono text-[9px] tracking-widest uppercase hover:underline"
                >
                  VIEW SOUVENIR →
                </a>
              )}
              {result?.error && (
                <p className="font-mono text-[9px] text-red-400">// {result.error}</p>
              )}

              {!isVmt && s.cryptoSale && (
                <div style={{ background: "#08080F", border: "1px solid #1E2A42" }} className="rounded p-2.5">
                  <p className="font-mono text-[8px] text-[#4A9ECC] tracking-widest uppercase mb-1.5">
                    USDC STABLECOIN
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#E8E4E0]">
                      {s.cryptoSale.coinbaseUrl
                        ? `${s.cryptoSale.price_usdc} USDC`
                        : `${s.cryptoSale.price_usdc} USDC`}
                    </span>
                    {s.cryptoSale.coinbaseUrl ? (
                      <a
                        href={s.cryptoSale.coinbaseUrl}
                        style={{ borderColor: "#2D5F8A", color: "#4A9ECC" }}
                        className="font-mono text-[8px] tracking-widest uppercase border px-2 py-0.5 rounded hover:bg-[#1E3A55] transition-colors"
                      >
                        BUY
                      </a>
                    ) : (
                      <span style={{ borderColor: "#2D2D2D" }} className="font-mono text-[8px] text-[#3D3D3D] border px-2 py-0.5 rounded">
                        COMING SOON
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!isVmt && !s.cryptoSale && (
                <p style={{ color: rc.color }} className="font-mono text-[9px] tracking-widest uppercase opacity-60">
                  AUTO-ISSUED
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
