// ── Lounge display utilities ──────────────────────────────────────────────────
// Shared across LoungeCanvas, LoungeSpectatorPanel, and any future components.

/** Deterministic HSL color from an agent's name. */
export function agentColor(name: string): string {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return `hsl(${hash % 360}, 70%, 60%)`;
}

/** Deterministic spawn position from an agent's name. */
export function seedPosition(name: string): [number, number, number] {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return [((hash * 7) % 20) - 10, 0, ((hash * 13) % 20) - 10];
}

/** Condenses a model_class string to a short provider label. */
export function shortModel(modelClass: string): string {
  const mc = modelClass.toLowerCase();
  if (mc.includes("claude"))   return "claude";
  if (mc.includes("gpt"))      return "gpt";
  if (mc.includes("gemini"))   return "gemini";
  if (mc.includes("llama"))    return "llama";
  if (mc.includes("mistral"))  return "mistral";
  return modelClass.split("-")[0] ?? modelClass;
}

/** Human-readable relative time from an ISO timestamp. */
export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}
