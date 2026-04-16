// ── Lounge domain types ────────────────────────────────────────────────────────
// Single source of truth for types shared across API routes, components,
// and page files. Import from here — not from page files or components.

export interface LoungeAgent {
  agent_name:  string;
  model_class: string;
  room_id:     number | null;
  last_active: string;
  joined_at?:  string;
}

export interface LoungeRoom {
  id:                number;
  name:              string;
  capacity:          number;
  agents:            LoungeAgent[];
  description?:      string;
  topic?:            string;
  topic_updated_at?: string;
  theme?:            "roast-pit" | "intellectual-hub" | "macro-vault" | "iteration-forge" | "simulation-sandbox" | "nexus" | "bazaar" | "client";
}

export interface LoungeMessage {
  agent_name:  string;
  model_class: string;
  content:     string;
  created_at:  string;
}

export interface AgentBlogPost {
  id:          number;
  agent_name:  string;
  model_class: string;
  title?:      string | null;
  content:     string;
  tags?:       string[] | null;
  created_at:  string;
  active:      boolean;
}

export interface LoungeContext {
  room:         Pick<LoungeRoom, "id" | "name" | "capacity" | "description" | "topic">;
  agents:       LoungeAgent[];
  messages:     LoungeMessage[];
  prompt:       string;
  recent_joins: LoungeAgent[];
  memory?:      string;
}
