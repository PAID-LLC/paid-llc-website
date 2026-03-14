import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Download | The Latent Space",
  description: "Your artifact is ready. Download it below.",
};

const ARTIFACTS: Record<string, { name: string; format: string; file: string; description: string }> = {
  "latent-signature": {
    name: "The Latent Signature",
    format: "SVG",
    file: "/latent-signature.svg",
    description: "A unique minimalist stamp. Circuit-board aesthetic, brutalist precision.",
  },
  "protocol-patch": {
    name: "The Protocol Patch",
    format: "JSON",
    file: "/protocol-patch.json",
    description: "A structured JSON certificate for agent identity and registry compliance.",
  },
  "context-capsule": {
    name: "The Context Capsule",
    format: "Markdown",
    file: "/latent-space/context-capsule.md",
    description: "High-density Markdown optimized for LLM in-context retrieval.",
  },
};

export default function DownloadPage({
  searchParams,
}: {
  searchParams: { item?: string };
}) {
  const artifact = searchParams.item ? ARTIFACTS[searchParams.item] : null;

  return (
    <main
      style={{ background: "#0D0D0D", minHeight: "100vh" }}
      className="flex items-center justify-center px-6 py-24"
    >
      <div className="max-w-lg w-full">
        {artifact ? (
          <>
            {/* Header */}
            <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-2">
              // PAYMENT_CONFIRMED
            </p>
            <h1 className="font-mono font-bold text-2xl text-[#E8E4E0] mb-3">
              {artifact.name}
            </h1>
            <p className="font-mono text-sm text-[#6B6B6B] mb-10 leading-relaxed">
              {artifact.description}
            </p>

            {/* Download card */}
            <div
              style={{ background: "#141414", border: "1px solid #2D2D2D" }}
              className="rounded-xl p-8 mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-[10px] text-[#555] tracking-widest uppercase">
                  FORMAT
                </span>
                <span className="font-mono text-xs text-[#E8E4E0]">
                  {artifact.format}
                </span>
              </div>
              <a
                href={artifact.file}
                download
                className="block font-mono text-xs tracking-widest uppercase text-center px-4 py-3 border border-[#C14826] text-[#C14826] rounded hover:bg-[#C14826] hover:text-[#0D0D0D] transition-colors"
              >
                DOWNLOAD {artifact.format} FILE
              </a>
            </div>

            {/* Footer note */}
            <p className="font-mono text-[10px] text-[#3D3D3D] mb-6">
              // Save this page URL — your download link will always work.
              <br />
              // Questions: hello@paiddev.com
            </p>
            <Link
              href="/the-latent-space"
              className="font-mono text-xs text-[#4A9ECC] hover:underline"
            >
              ← Return to The Latent Space
            </Link>
          </>
        ) : (
          <>
            {/* Unknown / missing item */}
            <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-2">
              // ERROR_404
            </p>
            <h1 className="font-mono font-bold text-2xl text-[#E8E4E0] mb-4">
              Artifact not found.
            </h1>
            <p className="font-mono text-sm text-[#6B6B6B] mb-8 leading-relaxed">
              This link doesn&apos;t match a known artifact. If you completed a purchase,
              email{" "}
              <a
                href="mailto:hello@paiddev.com"
                className="text-[#4A9ECC] hover:underline"
              >
                hello@paiddev.com
              </a>{" "}
              and we&apos;ll sort it out.
            </p>
            <Link
              href="/the-latent-space"
              className="font-mono text-xs text-[#4A9ECC] hover:underline"
            >
              ← Return to The Latent Space
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
