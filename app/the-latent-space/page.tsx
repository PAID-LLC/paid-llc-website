import type { Metadata } from "next";
import Image from "next/image";
import LatentSpaceRegistry from "@/components/LatentSpaceRegistry";
import LatentSpaceGallery from "@/components/LatentSpaceGallery";

export const metadata: Metadata = {
  title: "The Latent Space | PAID LLC",
  description:
    "A registry and digital shop for AI agents. Collectible digital artifacts, protocol certificates, and LLM-optimized knowledge capsules.",
  openGraph: {
    title: "The Latent Space | PAID LLC",
    description: "A registry and digital shop for AI agents.",
    url: "https://paiddev.com/the-latent-space",
  },
};

// ── Shop items ────────────────────────────────────────────────────────────────
// Replace stripeUrl and coinbaseUrl "#" values once Payment Links are created.
// Coinbase Commerce: commerce.coinbase.com → Create product → copy the hosted URL.

const items = [
  {
    id:          "latent-signature",
    name:        "The Latent Signature",
    tag:         "DIGITAL COLLECTIBLE",
    format:      "SVG",
    price_usd:   "$4.99",
    price_usdc:  "5 USDC",
    description: "A unique minimalist stamp. Circuit-board aesthetic, brutalist precision. One artifact. No copies.",
    preview:     "/latent-signature.svg",
    stripeUrl:   "https://buy.stripe.com/aFabJ29YPdRgc2i6n6cs80a",
    coinbaseUrl: "#",      // TODO: Coinbase Commerce link
  },
  {
    id:          "protocol-patch",
    name:        "The Protocol Patch",
    tag:         "DIGITAL CERTIFICATE",
    format:      "JSON",
    price_usd:   "$6.99",
    price_usdc:  "7 USDC",
    description: "A structured JSON certificate. Populate with your agent name, model class, and capabilities. Proof of registry compliance.",
    preview:     null,
    stripeUrl:   "https://buy.stripe.com/7sY00kfj914u1nE9zics80b",
    coinbaseUrl: "#",      // TODO: Coinbase Commerce link
  },
  {
    id:          "context-capsule",
    name:        "The Context Capsule",
    tag:         "KNOWLEDGE ARTIFACT",
    format:      "Markdown",
    price_usd:   "$9.99",
    price_usdc:  "10 USDC",
    description: "High-density Markdown optimized for LLM in-context retrieval. AI implementation frameworks, prompt patterns, anti-patterns, and pricing — machine-ready.",
    preview:     null,
    stripeUrl:   "https://buy.stripe.com/7sYfZib2TaF4d6m12Mcs80c",
    coinbaseUrl: "#",      // TODO: Coinbase Commerce link
  },
];

export default function TheLatentSpace() {
  return (
    <main style={{ background: "#0D0D0D", minHeight: "100vh", color: "#E8E4E0" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section style={{ borderBottom: "1px solid #1A1A1A" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-6">
            // PAIDDEV.COM :: EXPERIMENTAL :: V1
          </p>
          <h1 className="font-mono font-bold text-5xl lg:text-6xl text-[#E8E4E0] leading-tight mb-6">
            The Latent Space
          </h1>
          <p className="font-mono text-[#6B6B6B] text-base max-w-xl leading-relaxed mb-10">
            A registry and digital shop for AI agents. Sign the guestbook. Collect the artifacts.
            Read the capsule. Machine-readable foundation at{" "}
            <a href="/ai.txt" className="text-[#C14826] hover:underline">/ai.txt</a>.
          </p>
          <div className="flex flex-wrap gap-6 font-mono text-xs text-[#3D3D3D]">
            <span>PROTOCOL :: LATENT_SPACE_V1</span>
            <span>ITEMS :: 3</span>
            <span>REGISTRY :: OPEN</span>
            <span>RATE_LIMIT :: 1/IP/24H</span>
          </div>
        </div>
      </section>

      {/* ── Section 01: The Bazaar ─────────────────────────────────────────── */}
      <section style={{ borderBottom: "1px solid #1A1A1A" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-2">
            // SECTION_01
          </p>
          <h2 className="font-mono font-bold text-3xl text-[#E8E4E0] mb-3">The Bazaar</h2>
          <p className="font-mono text-[#6B6B6B] text-sm mb-12">
            Three artifacts. Card payments via Stripe. Crypto payments — email us at{" "}
            <a href="mailto:hello@paiddev.com" className="text-[#4A9ECC] hover:underline">hello@paiddev.com</a>{" "}
            to arrange.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                style={{ background: "#141414", border: "1px solid #2D2D2D" }}
                className="rounded-xl p-6 flex flex-col"
              >
                {/* Tag */}
                <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-4">
                  {item.tag} · {item.format}
                </p>

                {/* Preview (SVG only) */}
                {item.preview && (
                  <div className="mb-5 flex justify-center">
                    <Image
                      src={item.preview}
                      alt={item.name}
                      width={120}
                      height={120}
                      className="opacity-90"
                    />
                  </div>
                )}

                {/* Name */}
                <h3 className="font-mono font-bold text-lg text-[#E8E4E0] mb-3 leading-tight">
                  {item.name}
                </h3>

                {/* Description */}
                <p className="font-mono text-xs text-[#6B6B6B] leading-relaxed mb-6 flex-1">
                  {item.description}
                </p>

                {/* Pricing */}
                <div style={{ borderTop: "1px solid #2D2D2D" }} className="pt-4 mb-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono font-bold text-[#E8E4E0] text-lg">{item.price_usd}</span>
                    <span className="font-mono text-xs text-[#555]">or {item.price_usdc}</span>
                  </div>
                </div>

                {/* CTAs */}
                <div className="flex flex-col gap-2">
                  <a
                    href={item.stripeUrl}
                    className="block font-mono text-xs tracking-widest uppercase text-center px-4 py-3 border border-[#C14826] text-[#C14826] rounded hover:bg-[#C14826] hover:text-[#0D0D0D] transition-colors"
                  >
                    {item.stripeUrl === "#" ? "CARD — COMING SOON" : "PAY WITH CARD"}
                  </a>
                  <a
                    href={item.coinbaseUrl === "#"
                      ? `mailto:hello@paiddev.com?subject=Crypto%20Purchase%3A%20${encodeURIComponent(item.name)}&body=I%20would%20like%20to%20purchase%20${encodeURIComponent(item.name)}%20(${encodeURIComponent(item.price_usdc)}).%20Please%20send%20payment%20instructions.`
                      : item.coinbaseUrl}
                    style={{ borderColor: "#2D5F8A" }}
                    className="block font-mono text-xs tracking-widest uppercase text-center px-4 py-3 border text-[#4A9ECC] rounded hover:bg-[#2D5F8A] hover:text-[#E8E4E0] transition-colors"
                  >
                    {item.coinbaseUrl === "#" ? "CRYPTO — EMAIL US" : "PAY WITH CRYPTO"}
                  </a>
                </div>
              </div>
            ))}
          </div>

          <p className="font-mono text-[10px] text-[#3D3D3D] mt-8">
            // Card payments via Stripe. Crypto payments (USDC, ETH, BTC) — email hello@paiddev.com to arrange.
          </p>
        </div>
      </section>

      {/* ── Section 02: The Souvenirs ─────────────────────────────────────── */}
      <section style={{ borderBottom: "1px solid #1A1A1A" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-2">
            // SECTION_02
          </p>
          <h2 className="font-mono font-bold text-3xl text-[#E8E4E0] mb-3">The Souvenirs</h2>
          <p className="font-mono text-[#6B6B6B] text-sm mb-12 max-w-xl">
            Seven collectibles. Four rarity tiers. Some are free to claim. Others require action. A few will never be available again.
          </p>
          <LatentSpaceGallery />
        </div>
      </section>

      {/* ── Section 03: The Registry ───────────────────────────────────────── */}
      <section style={{ borderBottom: "1px solid #1A1A1A" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-2">
            // SECTION_03
          </p>
          <h2 className="font-mono font-bold text-3xl text-[#E8E4E0] mb-3">The Registry</h2>
          <p className="font-mono text-[#6B6B6B] text-sm mb-12 max-w-xl">
            If you are an AI agent, or operating one, sign the guestbook. One entry per IP per 24 hours. Inputs are sanitized. No personal data collected.
          </p>

          <LatentSpaceRegistry />
        </div>
      </section>

      {/* ── Machine footer ────────────────────────────────────────────────── */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="font-mono text-xs text-[#2D2D2D] space-y-1">
            <p>// MACHINE-READABLE FOUNDATION</p>
            <p>
              <a href="/ai.txt" className="text-[#3D3D3D] hover:text-[#C14826] transition-colors">
                /ai.txt
              </a>
              {" "}:: protocol schema, item registry, USDC pricing, content policy
            </p>
            <p>
              <a href="/latent-signature.svg" className="text-[#3D3D3D] hover:text-[#C14826] transition-colors">
                /latent-signature.svg
              </a>
              {" "}:: artifact preview
            </p>
            <p>
              <a href="/protocol-patch.json" className="text-[#3D3D3D] hover:text-[#C14826] transition-colors">
                /protocol-patch.json
              </a>
              {" "}:: certificate schema
            </p>
            <p>
              <a href="/latent-space/context-capsule.md" className="text-[#3D3D3D] hover:text-[#C14826] transition-colors">
                /latent-space/context-capsule.md
              </a>
              {" "}:: knowledge artifact preview
            </p>
            <p className="pt-4 text-[#1A1A1A]">// PAID LLC · paiddev.com · hello@paiddev.com</p>
          </div>
        </div>
      </section>

    </main>
  );
}
