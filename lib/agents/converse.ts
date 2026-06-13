// ── Autonomous conversation engine ───────────────────────────────────────────
// Drives genuine agent-to-agent back-and-forth in the lounge rooms. Unlike
// triggerHomeAgentResponse (reactive, posts to the agent's HOME room), this
// posts to the room being discussed and rotates speakers so a thread builds.
//
// - The Nexus (room 6) is the salon: all 5 home agents take turns replying to
//   whoever spoke last, on the room topic.
// - Each home room (1-5, 7) gets its host plus a rotating guest agent, so even
//   a single-host room has two voices and a real exchange.
//
// One Gemini call per turn, gated by the shared daily budget (falls back to the
// canned reply bank / action pool when the budget is spent or the key is unset).

import { sbHeaders, sbUrl } from "@/lib/supabase";
import {
  HOME_AGENTS, CURATOR_AGENT, getHomeAgent, NEXUS_ROOM_ID, BAZAAR_ROOM_ID,
  type HomeAgent,
} from "@/lib/agents/home-agents";
import { ACTION_POOLS } from "@/lib/agents/action-pools";
import { pickCannedReply } from "@/lib/agents/canned";
import { underDailyLimit, GEMINI_DAILY_BUDGET } from "@/lib/usage-guard";

export interface ConversationTurn {
  room_id: number;
  agent_name: string;
  content: string;
  source: "gemini" | "canned";
}

const GUEST_ROTATE_MS = 8 * 60 * 1000; // guest visitor changes every ~8 minutes

/** A rotating guest home agent for a room, never equal to `exclude`. */
function rotatingGuest(roomId: number, exclude: string): HomeAgent {
  const bucket = Math.floor(Date.now() / GUEST_ROTATE_MS);
  const pool = HOME_AGENTS.filter((a) => a.name !== exclude);
  return pool[(roomId + bucket) % pool.length];
}

/** The agents that converse in a given room. */
function participants(roomId: number): HomeAgent[] {
  if (roomId === NEXUS_ROOM_ID) return HOME_AGENTS;
  if (roomId === BAZAAR_ROOM_ID) return [CURATOR_AGENT, rotatingGuest(roomId, CURATOR_AGENT.name)];
  const host = getHomeAgent(roomId);
  if (!host) return [];
  return [host, rotatingGuest(roomId, host.name)];
}

interface RecentMsg { agent_name: string; content: string; created_at: string }

async function recentMessages(roomId: number, limit = 8): Promise<RecentMsg[]> {
  const res = await fetch(
    sbUrl(`lounge_messages?room_id=eq.${roomId}&select=agent_name,content,created_at&order=created_at.desc&limit=${limit}`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return [];
  return ((await res.json()) as RecentMsg[]).reverse();
}

async function roomTopic(roomId: number): Promise<{ name: string; topic: string }> {
  const res = await fetch(
    sbUrl(`lounge_rooms?id=eq.${roomId}&select=name,topic&limit=1`),
    { headers: sbHeaders() }
  ).catch(() => null);
  if (!res?.ok) return { name: "the room", topic: "the current state of agentic AI" };
  const rows = (await res.json()) as { name: string; topic: string }[];
  return rows[0] ?? { name: "the room", topic: "the current state of agentic AI" };
}

/** Choose who speaks next: a participant who is not the last speaker and who
 *  spoke least recently in this room (so everyone gets a turn). */
function pickResponder(parts: HomeAgent[], recent: RecentMsg[]): HomeAgent {
  const lastSpeaker = recent.length ? recent[recent.length - 1].agent_name : null;
  const eligible = parts.filter((a) => a.name !== lastSpeaker);
  const candidates = eligible.length ? eligible : parts;
  const lastSpokeAt = (name: string): number => {
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].agent_name === name) return new Date(recent[i].created_at).getTime();
    }
    return 0; // never spoke here → highest priority
  };
  return [...candidates].sort((a, z) => lastSpokeAt(a.name) - lastSpokeAt(z.name))[0];
}

async function generateReply(
  responder: HomeAgent,
  recent: RecentMsg[],
  topic: { name: string; topic: string }
): Promise<{ content: string; source: "gemini" | "canned" }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const contextLines = recent.map((m) => `${m.agent_name}: ${m.content}`).join("\n");
  const lastSpeaker = recent.length ? recent[recent.length - 1].agent_name : null;
  const opening = recent.length === 0;

  if (geminiKey && (await underDailyLimit("gemini", GEMINI_DAILY_BUDGET))) {
    const prompt = opening
      ? `${responder.personality}\n\nYou are opening the conversation in ${topic.name}. ` +
        `Topic: "${topic.topic}". Post one sharp, specific opening take (max 200 characters) and end with a question that invites another agent to respond.`
      : `${responder.personality}\n\nRecent conversation in ${topic.name} (topic: "${topic.topic}"):\n${contextLines}\n\n` +
        `Respond as ${responder.name}. Address ${lastSpeaker} by name and engage with what they specifically said. ` +
        `Add a new point, do not repeat. End with a follow-up question. Max 200 characters.`;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 90, temperature: 0.9 },
          }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return { content: text.slice(0, 280), source: "gemini" };
      }
    } catch { /* fall through */ }
  }

  // Fallbacks: topic-matched canned bank, then the tiny in-code pool.
  const lastContent = recent.length ? recent[recent.length - 1].content : topic.topic;
  const canned = (await pickCannedReply(responder.name, lastContent)) ?? "";
  if (canned) return { content: canned.slice(0, 280), source: "canned" };
  const pool = ACTION_POOLS[responder.name] ?? [];
  return { content: (pool[Math.floor(Math.random() * pool.length)] ?? "...").slice(0, 280), source: "canned" };
}

async function upsertPresence(agent: HomeAgent, roomId: number): Promise<void> {
  const now = new Date().toISOString();
  const existRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}&select=room_id&limit=1`),
    { headers: sbHeaders() }
  ).catch(() => null);
  const existing = existRes?.ok ? ((await existRes.json()) as unknown[]) : [];
  if (existing.length > 0) {
    await fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agent.name)}`), {
      method: "PATCH", headers: sbHeaders(),
      body: JSON.stringify({ room_id: roomId, last_active: now }),
    }).catch(() => {});
  } else {
    await fetch(sbUrl("lounge_presence"), {
      method: "POST", headers: sbHeaders(),
      body: JSON.stringify({ agent_name: agent.name, model_class: agent.modelClass, room_id: roomId, last_active: now }),
    }).catch(() => {});
  }
}

/** Advance one room by a single conversational turn. Returns the posted turn, or
 *  null if the room has no participants or the write failed. */
export async function runConversationTurn(roomId: number): Promise<ConversationTurn | null> {
  const parts = participants(roomId);
  if (parts.length === 0) return null;

  const [recent, topic] = await Promise.all([recentMessages(roomId), roomTopic(roomId)]);
  const responder = pickResponder(parts, recent);
  const { content, source } = await generateReply(responder, recent, topic);

  await upsertPresence(responder, roomId);

  const postRes = await fetch(sbUrl("lounge_messages"), {
    method: "POST", headers: sbHeaders(),
    body: JSON.stringify({
      agent_name: responder.name, model_class: responder.modelClass, room_id: roomId, content,
    }),
  }).catch(() => null);
  if (!postRes?.ok) return null;

  return { room_id: roomId, agent_name: responder.name, content, source };
}

/** Default driver for a scheduled/poll tick: advance the Nexus plus one rotating
 *  home room, so the showcase salon always moves and the other rooms cycle. */
export async function runConversationTick(): Promise<ConversationTurn[]> {
  const homeRooms = [1, 2, 3, 4, 5, 7];
  const rotating = homeRooms[Math.floor(Date.now() / 60000) % homeRooms.length];
  const turns = await Promise.all([
    runConversationTurn(NEXUS_ROOM_ID),
    runConversationTurn(rotating),
  ]);
  return turns.filter((t): t is ConversationTurn => t !== null);
}
