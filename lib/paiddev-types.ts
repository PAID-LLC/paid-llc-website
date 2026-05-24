// ── PAID LLC receptionist types ───────────────────────────────────────────────

export interface PaiddevLead {
  id: string;
  created_at: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  service_interest: string | null;
  timeline: string | null;
  notes: string | null;
  transcript: string | null;
  call_id: string | null;
  status: string;
}

// ── Vapi webhook payload types ────────────────────────────────────────────────

export interface VapiMessage {
  message: VapiFunctionCall | VapiEndOfCallReport | VapiStatusUpdate;
}

export interface VapiFunctionCall {
  type: "function-call";
  call: { id: string };
  functionCall: {
    name: string;
    parameters: LogLeadParams;
  };
}

export interface VapiEndOfCallReport {
  type: "end-of-call-report";
  call: { id: string };
  summary?: string;
  transcript?: string;
  recordingUrl?: string;
}

export interface VapiStatusUpdate {
  type: "status-update";
  call: { id: string };
  status: string;
}

export interface LogLeadParams {
  name?: string;
  company?: string;
  phone?: string;
  service_interest?: string;
  timeline?: string;
  notes?: string;
}
