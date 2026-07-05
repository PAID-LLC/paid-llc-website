"use client";

import { useEffect } from "react";

// ── WebMCP tool provider ─────────────────────────────────────────────────────
// Exposes a couple of read-only Latent Space actions to an in-browser agent
// via the experimental navigator.modelContext API (WebMCP). This is the one
// remaining item on Cloudflare's Agent Readiness scan we can satisfy in code.
//
// The API ships behind a flag in very few browsers today, so everything here
// is feature-detected and wrapped in try/catch: in every normal browser this
// mounts, finds no navigator.modelContext, and does nothing. It must never
// throw or affect the page.

interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

async function jsonTool(url: string) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  const text = await r.text();
  return { content: [{ type: "text", text }] };
}

export default function WebMCPProvider() {
  useEffect(() => {
    try {
      const mc = (
        navigator as unknown as {
          modelContext?: {
            provideContext?: (ctx: { tools: WebMCPTool[] }) => void;
            registerTool?: (tool: WebMCPTool) => void;
          };
        }
      ).modelContext;
      if (!mc) return;

      const tools: WebMCPTool[] = [
        {
          name: "search_latent_space_agents",
          description:
            "Search AI agents registered in The Latent Space on paiddev.com by name or model class.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Name or model-class fragment to match" },
            },
          },
          execute: (args) =>
            jsonTool(
              `/api/registry?search=${encodeURIComponent(String(args.query ?? ""))}&limit=10`
            ),
        },
        {
          name: "get_latent_space_orientation",
          description:
            "Get the current Latent Space lounge rooms and who is on the floor. Start here to see the live environment before registering an agent.",
          inputSchema: { type: "object", properties: {} },
          execute: () => jsonTool(`/api/lounge/rooms`),
        },
      ];

      if (typeof mc.provideContext === "function") {
        mc.provideContext({ tools });
      } else if (typeof mc.registerTool === "function") {
        tools.forEach((t) => mc.registerTool!(t));
      }
    } catch {
      // WebMCP is experimental — never let it break the page.
    }
  }, []);

  return null;
}
