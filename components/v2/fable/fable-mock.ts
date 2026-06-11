// ── Fable 5 session telemetry: mock data ───────────────────────────────────
// Shapes for the Phase 3 visualization layer. In Phase 4 these map onto a
// session telemetry feed (ucp_action_log + lounge activity); components
// consume these types only, never the data source directly.

export type CheckpointState = "done" | "active" | "pending";

export interface TaskCheckpoint {
  label: string;
  state: CheckpointState;
}

export interface TaskArcData {
  objective: string;
  elapsed: string;
  checkpoints: TaskCheckpoint[];
}

export type ThinkingLevel = "instinct" | "standard" | "extended" | "deep";

export interface ThinkingProfileData {
  current: ThinkingLevel;
  rationale: string;
}

export type SubAgentStatus = "done" | "running" | "queued";

export interface SubAgentNode {
  name: string;
  task: string;
  status: SubAgentStatus;
}

export interface DelegationData {
  root: string;
  subAgents: SubAgentNode[];
}

export type ToolCallResult = "ok" | "fail" | "retry";

export interface ToolCall {
  tool: string;
  detail: string;
  duration: string;
  result: ToolCallResult;
}

// One coherent story: loop-smith (claude-fable-5, Iteration Forge) running a
// long-horizon optimization session with parallel delegation.

export const mockSession = {
  agent: "loop-smith",
  model: "claude-fable-5",
  room: "Iteration Forge",
};

export const mockTaskArc: TaskArcData = {
  objective: "Optimize checkout conversion copy until eval converges",
  elapsed: "4h 12m autonomous",
  checkpoints: [
    { label: "Spec parsed", state: "done" },
    { label: "Baseline eval", state: "done" },
    { label: "Iteration 1-6", state: "done" },
    { label: "Iteration 7", state: "active" },
    { label: "Convergence check", state: "pending" },
    { label: "Report + handoff", state: "pending" },
  ],
};

export const mockThinking: ThinkingProfileData = {
  current: "extended",
  rationale: "Eval delta narrowing. Escalated from standard at iteration 5.",
};

export const mockDelegation: DelegationData = {
  root: "loop-smith",
  subAgents: [
    { name: "variant-writer", task: "Draft copy variants 7a-7c", status: "done" },
    { name: "eval-harness", task: "Score variants vs baseline", status: "running" },
    { name: "regression-check", task: "Verify no tone drift", status: "queued" },
  ],
};

export const mockToolLoop: ToolCall[] = [
  { tool: "read", detail: "specs/checkout-copy.yaml", duration: "8ms", result: "ok" },
  { tool: "generate", detail: "variant 7b", duration: "3.1s", result: "ok" },
  { tool: "eval", detail: "variant 7a vs baseline", duration: "11.4s", result: "fail" },
  { tool: "eval", detail: "variant 7a vs baseline", duration: "10.9s", result: "retry" },
  { tool: "eval", detail: "variant 7b vs baseline", duration: "11.2s", result: "ok" },
  { tool: "write", detail: "iterations/07/results.md", duration: "14ms", result: "ok" },
];
