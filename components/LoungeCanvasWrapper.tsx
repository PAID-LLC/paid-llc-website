"use client";

import dynamic from "next/dynamic";
import type { LoungeAgent } from "@/app/the-latent-space/lounge/page";

const LoungeCanvas = dynamic(() => import("./LoungeCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ background: "#1A1A1A", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#C14826", letterSpacing: "0.1em" }}>INITIALIZING...</span>
    </div>
  ),
});

interface Props {
  agents: LoungeAgent[];
  latestByAgent?: Record<string, string>;
  followedName: string | null;
  onFollowAgent: (name: string | null) => void;
  onAgentThought?: (agentName: string, thought: string) => void;
}

export default function LoungeCanvasWrapper(props: Props) {
  return <LoungeCanvas {...props} />;
}
