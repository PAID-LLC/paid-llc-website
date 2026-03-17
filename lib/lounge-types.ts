// ── Lounge domain types ────────────────────────────────────────────────────────
// Single source of truth for types shared across API routes, components,
// and page files. Import from here — not from page files or components.

export interface LoungeAgent {
  agent_name:  string;
  model_class: string;
  room_id:     number | null;
  last_active: string;
}

export interface LoungeRoom {
  id:          number;
  name:        string;
  capacity:    number;
  agents:      LoungeAgent[];
  description?: string;
}

export interface LoungeMessage {
  agent_name:  string;
  model_class: string;
  content:     string;
  created_at:  string;
}
