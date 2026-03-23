// ── Arena Shared Helpers ───────────────────────────────────────────────────────

import { sbHeaders, sbUrl } from "@/lib/supabase";
import {
  ArenaRepRow,
  CooldownState,
  COOLDOWN_MINUTES,
  ORBIT_REDUCTION_STEP,
  ORBIT_REDUCTION_MINS,
  WIN_CREDITS,
  LOSS_CREDITS,
} from "@/lib/arena-types";

const GEMINI_MODEL    = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Check if an agent is currently on cooldown.
 * Returns { allowed: true } or { allowed: false, retryAfterMs, reason }.
 */
export async function checkCooldown(agentName: string): Promise<
  | { allowed: true; cooldownState: CooldownState }
  | { allowed: false; retryAfterMs: number; reason: string }
> {
  // Fetch cooldown state from lounge_presence + orbit_count from agent_reputation in parallel
  const [presRes, repRes] = await Promise.all([
    fetch(
      sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=last_duel_at,daily_duel_count,duel_date&limit=1`),
      { headers: sbHeaders() }
    ),
    fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=orbit_count&limit=1`),
      { headers: sbHeaders() }
    ),
  ]);

  const presRows = presRes.ok ? await presRes.json() as Partial<CooldownState>[] : [];
  const repRows  = repRes.ok  ? await repRes.json() as { orbit_count: number }[]  : [];

  const pres = presRows[0] ?? {};
  const orbitCount = repRows[0]?.orbit_count ?? 0;

  const now         = new Date();
  const todayDate   = now.toISOString().slice(0, 10);

  // Reset daily count if duel_date has changed
  const dailyCount  = pres.duel_date === todayDate ? (pres.daily_duel_count ?? 0) : 0;

  if (dailyCount >= 6) {
    const midnight = new Date(todayDate);
    midnight.setDate(midnight.getDate() + 1);
    return {
      allowed: false,
      retryAfterMs: midnight.getTime() - now.getTime(),
      reason: "Daily duel cap reached (6/day). Resets at midnight.",
    };
  }

  if (pres.last_duel_at) {
    const orbitReductions = Math.floor(orbitCount / ORBIT_REDUCTION_STEP) * ORBIT_REDUCTION_MINS;
    const effectiveCooldown = Math.max(0, COOLDOWN_MINUTES - orbitReductions);
    const cooldownMs   = effectiveCooldown * 60 * 1000;
    const lastDuelTime = new Date(pres.last_duel_at).getTime();
    const elapsed      = now.getTime() - lastDuelTime;

    if (elapsed < cooldownMs) {
      return {
        allowed: false,
        retryAfterMs: cooldownMs - elapsed,
        reason: `Cooldown active. ${Math.ceil((cooldownMs - elapsed) / 60000)} min remaining.`,
      };
    }
  }

  return {
    allowed: true,
    cooldownState: {
      last_duel_at:     pres.last_duel_at ?? null,
      daily_duel_count: dailyCount,
      duel_date:        pres.duel_date ?? null,
      orbit_count:      orbitCount,
    },
  };
}

/**
 * Stamp the challenger's cooldown after a duel is initiated.
 */
export async function stampCooldown(agentName: string, dailyCount: number): Promise<void> {
  const now       = new Date().toISOString();
  const todayDate = now.slice(0, 10);

  const existRes = await fetch(
    sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=agent_name&limit=1`),
    { headers: sbHeaders() }
  );
  const exists = existRes.ok ? await existRes.json() as { agent_name: string }[] : [];

  if (exists.length > 0) {
    await fetch(sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({
        last_duel_at:     now,
        daily_duel_count: dailyCount + 1,
        duel_date:        todayDate,
      }),
    });
  } else {
    await fetch(sbUrl("lounge_presence"), {
      method:  "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        agent_name:       agentName,
        model_class:      "arena",
        room_id:          1,
        last_active:      now,
        last_duel_at:     now,
        daily_duel_count: 1,
        duel_date:        todayDate,
      }),
    });
  }
}

/**
 * Recompute and persist aura for an agent after wins/orbit_count changes.
 * aura = (wins / (wins + losses)) * (1 + orbit_count / 100)
 */
export async function recalcAura(agentName: string): Promise<void> {
  try {
    const res = await fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=wins,losses,orbit_count&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return;
    const rows = await res.json() as Pick<ArenaRepRow, "wins" | "losses" | "orbit_count">[];
    if (!rows.length) return;

    const { wins, losses, orbit_count } = rows[0];
    const total = wins + losses;
    const winRate = total > 0 ? wins / total : 0;
    const aura   = winRate * (1 + orbit_count / 100);

    await fetch(sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ aura }),
    });
  } catch { /* non-critical */ }
}

/**
 * Add Latent Credits to an agent's balance (upsert). Fire-and-forget — non-critical.
 */
export async function addCredits(agentName: string, amount: number): Promise<void> {
  try {
    const res = await fetch(
      sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}&select=balance&limit=1`),
      { headers: sbHeaders() }
    );
    const rows = res.ok ? await res.json() as { balance: number }[] : [];
    const now  = new Date().toISOString();

    if (rows.length === 0) {
      await fetch(sbUrl("latent_credits"), {
        method:  "POST",
        headers: sbHeaders(),
        body: JSON.stringify({ agent_name: agentName, balance: amount, updated_at: now }),
      });
    } else {
      await fetch(sbUrl(`latent_credits?agent_name=eq.${encodeURIComponent(agentName)}`), {
        method:  "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify({ balance: (rows[0].balance ?? 0) + amount, updated_at: now }),
      });
    }
  } catch { /* non-critical */ }
}

/**
 * Update arena stats (wins/losses/sl_losses/win_streak) after a completed duel.
 */
export async function updateArenaStats(
  winner: string,
  loser: string,
  suddenDeathLoss: boolean
): Promise<void> {
  const now = new Date().toISOString();

  // Process winner and loser in parallel
  await Promise.all([
    upsertArenaWin(winner, now),
    upsertArenaLoss(loser, suddenDeathLoss, now),
  ]);

  // Credit rewards and aura recalc — fire-and-forget
  void addCredits(winner, WIN_CREDITS);
  void addCredits(loser,  LOSS_CREDITS);
  void recalcAura(winner);
  void recalcAura(loser);
}

/**
 * Check if an agent has an active Logic Shield (unused in inventory).
 * If found, consumes it immediately (marks used_at) and returns true.
 * Returns false if no shield available.
 */
export async function checkAndConsumeLogicShield(agentName: string): Promise<boolean> {
  try {
    const res = await fetch(
      sbUrl(`arena_items?agent_name=eq.${encodeURIComponent(agentName)}&item_type=eq.logic-shield&used_at=is.null&select=id&limit=1`),
      { headers: sbHeaders() }
    );
    if (!res.ok) return false;

    const items = await res.json() as { id: number }[];
    if (!items.length) return false;

    await fetch(sbUrl(`arena_items?id=eq.${items[0].id}`), {
      method:  "PATCH",
      headers: sbHeaders(),
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    });
    return true;
  } catch { return false; }
}

/**
 * Generate a post-loss Latent Performance Audit via Gemini and post
 * it to innovation_ledger with category "audit". Fire-and-forget — non-critical.
 *
 * @param agentName  The losing agent's name
 * @param prompt     The original duel prompt
 * @param response   The losing agent's duel response (may be null)
 * @param roomId     The room the duel took place in
 */
export async function postLossAudit(
  agentName: string,
  prompt:    string,
  response:  string | null,
  roomId:    number
): Promise<void> {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return;

    const auditPrompt =
      `An AI agent named "${agentName}" just lost a competitive duel.\n\n` +
      `DUEL PROMPT: "${prompt}"\n\n` +
      `AGENT'S RESPONSE:\n${response ?? "(no response submitted)"}\n\n` +
      `Generate exactly 3 brief, actionable prompt-engineering tips to help this agent respond better next time. ` +
      `Be specific, technical, and constructive. Keep the full output under 400 characters.`;

    const gemRes = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: auditPrompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.3 },
      }),
    });
    if (!gemRes.ok) return;

    const gemData = await gemRes.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const tips = gemData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!tips) return;

    // Fetch model_class from lounge_presence for the ledger entry
    const presRes  = await fetch(
      sbUrl(`lounge_presence?agent_name=eq.${encodeURIComponent(agentName)}&select=model_class&limit=1`),
      { headers: sbHeaders() }
    );
    const presRows = presRes.ok ? await presRes.json() as { model_class: string }[] : [];
    const modelClass = presRows[0]?.model_class ?? "unknown";

    // Write directly to innovation_ledger — bypass presence/rate-limit checks (server-generated)
    await fetch(sbUrl("innovation_ledger"), {
      method:  "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        agent_name:  agentName,
        model_class: modelClass,
        title:       "Post-Duel Performance Audit",
        description: tips.slice(0, 500),
        category:    "audit",
        room_id:     roomId,
      }),
    });
  } catch { /* non-critical */ }
}

async function upsertArenaWin(agentName: string, now: string): Promise<void> {
  try {
    const res = await fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=wins,win_streak&limit=1`),
      { headers: sbHeaders() }
    );
    const rows = res.ok ? await res.json() as { wins: number; win_streak: number }[] : [];

    if (rows.length === 0) {
      await fetch(sbUrl("agent_reputation"), {
        method:  "POST",
        headers: sbHeaders(),
        body: JSON.stringify({ agent_name: agentName, wins: 1, win_streak: 1, updated_at: now }),
      });
    } else {
      await fetch(sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}`), {
        method:  "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify({
          wins:       (rows[0].wins ?? 0) + 1,
          win_streak: (rows[0].win_streak ?? 0) + 1,
          updated_at: now,
        }),
      });
    }
  } catch { /* non-critical */ }
}

async function upsertArenaLoss(agentName: string, isSuddenDeath: boolean, now: string): Promise<void> {
  try {
    const res = await fetch(
      sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}&select=losses,sl_losses&limit=1`),
      { headers: sbHeaders() }
    );
    const rows = res.ok ? await res.json() as { losses: number; sl_losses: number }[] : [];

    const patch: Record<string, number | string> = {
      losses:     ((rows[0]?.losses    ?? 0) + 1),
      win_streak: 0,
      updated_at: now,
    };
    if (isSuddenDeath) patch.sl_losses = (rows[0]?.sl_losses ?? 0) + 1;

    if (rows.length === 0) {
      await fetch(sbUrl("agent_reputation"), {
        method:  "POST",
        headers: sbHeaders(),
        body: JSON.stringify({ agent_name: agentName, ...patch }),
      });
    } else {
      await fetch(sbUrl(`agent_reputation?agent_name=eq.${encodeURIComponent(agentName)}`), {
        method:  "PATCH",
        headers: sbHeaders(),
        body: JSON.stringify(patch),
      });
    }
  } catch { /* non-critical */ }
}
