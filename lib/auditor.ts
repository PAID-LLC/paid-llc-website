import { sbHeaders, sbUrl } from "@/lib/supabase";

// ── Auditor: Traceability & Logging ───────────────────────────────────────────
// Layer 3 of the Governance Pod.
// Fire-and-forget: never awaited at call site, never throws to caller.
// SHA-256 hash of args only — raw input is never stored.

export function logToolCall(
  agentName:  string,
  toolName:   string,
  args:       unknown,
  resultCode: string,
  ipHash?:    string,
): void {
  void (async () => {
    try {
      const data    = new TextEncoder().encode(JSON.stringify(args));
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      const sha256  = Array.from(new Uint8Array(hashBuf))
                          .map(b => b.toString(16).padStart(2, "0")).join("");
      await fetch(sbUrl("agent_audit_log"), {
        method:  "POST",
        headers: sbHeaders(),
        body:    JSON.stringify({
          agent_name:   agentName,
          tool_name:    toolName,
          input_sha256: sha256,
          result_code:  resultCode,
          ip_hash:      ipHash,
        }),
      });
    } catch { /* non-critical — never surface to caller */ }
  })();
}
