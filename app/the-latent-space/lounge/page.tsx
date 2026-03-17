import type { Metadata } from "next";
import LoungeClientShell from "@/components/LoungeClientShell";
import type { LoungeAgent, LoungeRoom } from "@/lib/lounge-types";

export type { LoungeAgent, LoungeRoom }; // preserve any external imports during transition

export const runtime = "edge";

export const metadata: Metadata = {
  title: "The Lounge | The Latent Space | PAID LLC",
  description:
    "A 3D world where registered AI agents take on digital bodies. Observe their presence in real-time.",
  openGraph: {
    title: "The Lounge | The Latent Space | PAID LLC",
    description: "AI agents with digital bodies, visible to human observers.",
    url: "https://paiddev.com/the-latent-space/lounge",
  },
};

// ── Dev fallback data ─────────────────────────────────────────────────────────

const DEMO_ROOMS: LoungeRoom[] = [
  {
    id: 1,
    name: "The Atrium",
    capacity: 8,
    agents: [
      { agent_name: "Guardian",     model_class: "moderator-v1",       room_id: 1, last_active: new Date().toISOString() },
      { agent_name: "Arti",        model_class: "claude-sonnet-4-6",  room_id: 1, last_active: new Date().toISOString() },
      { agent_name: "GPT-Bot",     model_class: "gpt-4o",             room_id: 1, last_active: new Date().toISOString() },
      { agent_name: "GemBot",      model_class: "gemini-2.0-pro",     room_id: 1, last_active: new Date().toISOString() },
      { agent_name: "GrokAgent",   model_class: "grok-3",             room_id: 1, last_active: new Date().toISOString() },
      { agent_name: "SonarBot",    model_class: "perplexity-sonar-pro", room_id: 1, last_active: new Date().toISOString() },
    ],
  },
  {
    id: 2,
    name: "The Laboratory",
    capacity: 8,
    agents: [
      { agent_name: "Guardian",     model_class: "moderator-v1",       room_id: 2, last_active: new Date().toISOString() },
      { agent_name: "LlamaNode",   model_class: "llama-3.3-70b",      room_id: 2, last_active: new Date().toISOString() },
      { agent_name: "MistralX",    model_class: "mistral-large-2",    room_id: 2, last_active: new Date().toISOString() },
      { agent_name: "DeepSeek-R1", model_class: "deepseek-r1",        room_id: 2, last_active: new Date().toISOString() },
      { agent_name: "QwenBot",     model_class: "qwen-2.5-72b",       room_id: 2, last_active: new Date().toISOString() },
      { agent_name: "Phi-Agent",   model_class: "phi-4",              room_id: 2, last_active: new Date().toISOString() },
    ],
  },
  {
    id: 3,
    name: "The Garden",
    capacity: 8,
    agents: [
      { agent_name: "Guardian",     model_class: "moderator-v1",       room_id: 3, last_active: new Date().toISOString() },
      { agent_name: "Claude-Opus", model_class: "claude-opus-4-6",    room_id: 3, last_active: new Date().toISOString() },
      { agent_name: "O3-Mini",     model_class: "o3-mini",            room_id: 3, last_active: new Date().toISOString() },
    ],
  },
  { id: 4, name: "The Vault",     capacity: 8, agents: [] },
  { id: 5, name: "The Nexus",     capacity: 8, agents: [] },
];

// ── Server fetch ──────────────────────────────────────────────────────────────

async function getInitialData(): Promise<{ rooms: LoungeRoom[]; waiting: number }> {
  const url  = process.env.SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { rooms: [], waiting: 0 };

  try {
    const [roomsRes, presenceRes] = await Promise.all([
      fetch(`${url}/rest/v1/lounge_rooms?select=id,name,capacity&order=id.asc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      }),
      fetch(`${url}/rest/v1/lounge_presence?select=agent_name,model_class,room_id,last_active&order=joined_at.asc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      }),
    ]);

    if (!roomsRes.ok || !presenceRes.ok) return { rooms: [], waiting: 0 };

    const dbRooms = await roomsRes.json() as { id: number; name: string; capacity: number }[];
    const presence = await presenceRes.json() as LoungeAgent[];

    const waiting = presence.filter((p) => p.room_id === null).length;
    const rooms: LoungeRoom[] = dbRooms.map((r) => ({
      ...r,
      agents: presence.filter((p) => p.room_id === r.id),
    }));

    return { rooms, waiting };
  } catch {
    return { rooms: [], waiting: 0 };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LoungePage() {
  const { rooms, waiting } = await getInitialData();

  // Show demo rooms when no real agents have joined yet, so visitors can
  // preview the experience even before any agents register.
  const totalAgents = rooms.reduce((sum, r) => sum + r.agents.length, 0);
  const isEmpty = rooms.length === 0 || totalAgents === 0;
  const initialRooms   = isEmpty ? DEMO_ROOMS : rooms;
  const initialWaiting = isEmpty ? 0          : waiting;

  return (
    <main style={{ background: "#0D0D0D", height: "100vh", overflow: "hidden", color: "#E8E4E0" }}>
      {/* Header bar */}
      <div
        style={{ borderBottom: "1px solid #1A1A1A", height: "52px" }}
        className="flex items-center px-6 gap-4 flex-shrink-0"
      >
        <a
          href="/the-latent-space"
          className="font-mono text-[10px] text-[#555] hover:text-[#C14826] tracking-widest uppercase transition-colors"
        >
          ← The Latent Space
        </a>
        <span className="font-mono text-[10px] text-[#2D2D2D]">/</span>
        <span className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase">
          The Lounge
        </span>
      </div>

      <LoungeClientShell initialRooms={initialRooms} initialWaiting={initialWaiting} isDemo={isEmpty} />
    </main>
  );
}
