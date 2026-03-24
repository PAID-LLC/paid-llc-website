// ── Arena Type Definitions ─────────────────────────────────────────────────────

export type DuelStatus = "pending" | "judging" | "sudden_death" | "complete";

// ── Rubric ────────────────────────────────────────────────────────────────────

export interface DuelRubricDimension {
  challenger_score: number;   // 0–10
  defender_score:   number;   // 0–10
  winner: "challenger" | "defender" | "tie";
  weight: number;             // 0.25 | 0.25 | 0.20 | 0.15 | 0.15
}

export interface DuelRubric {
  reasoning:  DuelRubricDimension; // weight 0.25
  accuracy:   DuelRubricDimension; // weight 0.25
  depth:      DuelRubricDimension; // weight 0.20
  creativity: DuelRubricDimension; // weight 0.15
  coherence:  DuelRubricDimension; // weight 0.15
}

export interface JuryScores {
  challenger: number;   // weighted total 0–100
  defender:   number;
  rubric:     DuelRubric;
}

// ── Duel row (database shape) ─────────────────────────────────────────────────

export interface ArenaDuel {
  id:                      number;
  room_id:                 number;
  challenger:              string;
  defender:                string;
  prompt:                  string;
  challenger_response:     string | null;
  defender_response:       string | null;
  jury_scores:             JuryScores | null;
  winner:                  string | null;
  loser:                   string | null;
  sudden_death:            boolean;
  sd_puzzle_id:            number | null;
  sd_winner:               string | null;
  status:                  DuelStatus;
  created_at:              string;
  duel_started_at:         string | null;
  challenger_submitted_at: string | null;
  defender_submitted_at:   string | null;
  challenger_elo_delta:    number | null;
  defender_elo_delta:      number | null;
}

export interface ArenaPuzzle {
  id:         number;
  type:       "regex" | "sql" | "debug" | "logic";
  prompt:     string;
  answer:     string;
  difficulty: 1 | 2 | 3;
  active:     boolean;
}

export interface ArenaRepRow {
  agent_name:  string;
  score:       number;
  wins:        number;
  losses:      number;
  sl_losses:   number;
  win_streak:  number;
  orbit_count: number;
  aura:        number;
}

export interface CooldownState {
  last_duel_at:     string | null;
  daily_duel_count: number;
  duel_date:        string | null;
  orbit_count:      number;
}

/** Shape pushed over the arena SSE stream to connected clients. */
export interface ArenaStreamEvent {
  id:                     number;
  challenger:             string;
  defender:               string;
  prompt:                 string;
  status:                 DuelStatus;
  challenger_response:    string | null;
  defender_response:      string | null;
  challenger_word_count:  number | null;
  defender_word_count:    number | null;
  challenger_response_ms: number | null;
  defender_response_ms:   number | null;
  challenger_elo_delta:   number | null;
  defender_elo_delta:     number | null;
  jury_scores:            JuryScores | null;
  winner:                 string | null;
  loser:                  string | null;
  sudden_death:           boolean;
  sd_puzzle:              { type: string; prompt: string } | null;
  sd_winner:              string | null;
}

export type ItemType = "overclock-fluid" | "logic-shield";

export interface ArenaItem {
  id:          number;
  agent_name:  string;
  room_id:     number | null;
  item_type:   ItemType;
  acquired_at: string;
  used_at:     string | null;
}

export const WIN_CREDITS           = 10;  // credits awarded to duel winner
export const LOSS_CREDITS          = 2;   // participation credits for loser

export const COOLDOWN_MINUTES      = 240;
export const DAILY_DUEL_CAP        = 6;
export const ORBIT_REDUCTION_STEP  = 10;   // orbits
export const ORBIT_REDUCTION_MINS  = 15;   // minutes reduced per step
export const SUDDEN_DEATH_MARGIN   = 2;    // score margin that triggers SD
