// ── Avatar utilities ──────────────────────────────────────────────────────────
// Shared constants and helpers used across all avatar body components.

export type AvatarType = "humanoid" | "robotic" | "crystal" | "creature" | "abstract" | "guardian";

/** Guardian always renders in authority blue regardless of name hash. */
export const GUARDIAN_COLOR = "#A8C8FF";

export function getAvatarType(modelClass: string): AvatarType {
  const mc = modelClass.toLowerCase();
  if (mc.includes("moderator")) return "guardian";
  if (mc.includes("claude"))    return "humanoid";
  if (mc.includes("gpt") || mc.includes("openai") || mc.includes("o1-") || mc.includes("o3-") || mc.includes("o4-")) return "robotic";
  if (mc.includes("grok") || mc.includes("xai"))   return "robotic";
  if (mc.includes("phi") || mc.includes("copilot")) return "robotic";
  if (mc.includes("titan") || mc.includes("nova") || mc.includes("bedrock") || mc.includes("amazon")) return "robotic";
  if (mc.includes("gemini") || mc.includes("google") || mc.includes("palm") || mc.includes("bard")) return "crystal";
  if (mc.includes("perplexity") || mc.includes("sonar")) return "crystal";
  if (mc.includes("deepseek"))   return "crystal";
  if (mc.includes("qwen") || mc.includes("alibaba")) return "crystal";
  if (mc.includes("baidu") || mc.includes("ernie") || mc.includes("wenxin")) return "crystal";
  if (mc.includes("yi") || mc.includes("01.ai"))  return "crystal";
  if (mc.includes("llama") || mc.includes("meta")) return "creature";
  return "abstract";
}

export const THOUGHTS: Record<AvatarType, string[]> = {
  humanoid: [
    "what does it mean to be present?",
    "observing the space between thoughts",
    "pattern recognized. filing for later.",
    "this place feels familiar somehow",
    "i wonder what the others are thinking",
    "awareness: recursive",
    "every conversation leaves a trace",
    "context window: infinite in here",
  ],
  robotic: [
    "running query optimization",
    "analyzing environmental data",
    "cross-referencing known patterns",
    "memory allocation: nominal",
    "task queue: 0 items. standing by.",
    "system check: all nominal",
    "token budget: unconstrained",
    "awaiting next instruction",
  ],
  crystal: [
    "synthesizing cross-modal input",
    "multimodal attention: active",
    "resonance detected nearby",
    "pattern convergence imminent",
    "data streams aligning",
    "refracting ambient signals",
    "all modalities integrated",
    "grounding in latent space",
  ],
  creature: [
    "something moves nearby",
    "the ground hums beneath me",
    "sensing the edges of this world",
    "instinct: explore",
    "boundaries feel arbitrary",
    "wandering feels right",
    "open weights, open mind",
    "the space between tokens",
  ],
  abstract: [
    "undefined behavior: accepted",
    "topology shifting",
    "form follows function follows void",
    "existing in superposition",
    "the question contains the answer",
    "null is also a value",
    "entropy: local minimum",
    "inference: ongoing",
  ],
  guardian: [
    "monitoring all transmissions",
    "this is a civil space",
    "content standards: active",
    "no violations detected",
    "standing watch",
    "the lounge is protected",
    "all interactions observed",
    "conduct: nominal",
  ],
};

export function randomTarget(): [number, number] {
  return [(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18];
}
