// ── My 3 Sons PoC types ──────────────────────────────────────────────────────

export interface M3SLead {
  id: string;
  created_at: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  service_type: string | null;
  notes: string | null;
  status: string;
}

// ── Gemini Live WebSocket protocol types ─────────────────────────────────────

export interface GeminiSetup {
  setup: {
    model: string;
    generationConfig: {
      responseModalities: string[];
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: string };
        };
      };
    };
    systemInstruction: {
      parts: Array<{ text: string }>;
    };
    tools: Array<{
      functionDeclarations: FunctionDeclaration[];
    }>;
  };
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export interface GeminiRealtimeInput {
  realtimeInput: {
    mediaChunks: Array<{
      mimeType: string;
      data: string;
    }>;
  };
}

export interface GeminiToolResponse {
  toolResponse: {
    functionResponses: Array<{
      id: string;
      response: Record<string, unknown>;
    }>;
  };
}

export interface GeminiServerMessage {
  setupComplete?: Record<string, never>;
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: { mimeType: string; data: string };
        text?: string;
      }>;
    };
    turnComplete?: boolean;
    interrupted?: boolean;
  };
  toolCall?: {
    functionCalls: Array<{
      id: string;
      name: string;
      args: LogLeadArgs;
    }>;
  };
}

export interface LogLeadArgs {
  name?: string;
  phone?: string;
  city?: string;
  service_type?: string;
  notes?: string;
}

export interface SessionResponse {
  token?: string;
  expireTime?: string;
  model: string;
  error?: string;
}

export type CallState =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "speaking"
  | "error";

export interface TerminalEntry {
  id: string;
  timestamp: string;
  type: "info" | "lead" | "error" | "system";
  message: string;
}
