import type { Metadata } from "next";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

export const runtime = "edge";

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

export default async function DownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  const artifact = item ? ARTIFACTS[item] : null;

  return (
    <section className={`${v2.section} flex min-h-[70vh] items-center justify-center py-24`}>
      <div className="w-full max-w-lg">
        {artifact ? (
          <>
            <p className={v2.kicker}>Payment confirmed</p>
            <h1 className={`${v2.h2} mt-4 mb-3`}>{artifact.name}</h1>
            <p className={`${v2.bodySm} mb-10`}>{artifact.description}</p>

            <div className={`${v2.cardStatic} mb-8 p-8`}>
              <div className="mb-6 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Format</span>
                <span className="font-mono text-xs text-zinc-100">{artifact.format}</span>
              </div>
              <a href={artifact.file} download className={`${v2.btnPrimary} w-full justify-center`}>
                Download {artifact.format} file
              </a>
            </div>

            <p className={`${v2.mono} mb-6`}>
              Save this page URL: your download link will always work.
              <br />
              Questions: hello@paiddev.com
            </p>
            <Link href="/the-latent-space" className="font-mono text-xs text-cyan-300 transition-colors hover:text-cyan-200">
              &larr; Return to The Latent Space
            </Link>
          </>
        ) : (
          <>
            <p className={v2.kicker}>Error 404</p>
            <h1 className={`${v2.h2} mt-4 mb-4`}>Artifact not found.</h1>
            <p className={`${v2.bodySm} mb-8`}>
              This link doesn&apos;t match a known artifact. If you completed a purchase, email{" "}
              <a href="mailto:hello@paiddev.com" className="text-cyan-300 hover:text-cyan-200">
                hello@paiddev.com
              </a>{" "}
              and we&apos;ll sort it out.
            </p>
            <Link href="/the-latent-space" className="font-mono text-xs text-cyan-300 transition-colors hover:text-cyan-200">
              &larr; Return to The Latent Space
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
