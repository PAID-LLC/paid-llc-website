import { sbHeaders, sbUrl } from "@/lib/supabase";
import { defer } from "@/lib/defer";

// ── Auditor: Traceability & Logging ───────────────────────────────────────────
// Layer 3 of the Governance Pod.
// SHA-256 hash of args only — raw input is never stored.
//
// Deferred, not detached. This used to be a synchronous function wrapping a
// `void (async () => ...)()` IIFE, which on the Cloudflare edge meant the audit
// row could be dropped whenever the isolate froze at response time. An audit log
// with silent holes in it is worse than no audit log, because the holes are
// indistinguishable from "nothing happened".
//
// Callers must `await` this. It never throws and never blocks the response on
// the actual write: defer() hands the work to ctx.waitUntil() where available,
// and only falls back to awaiting when no request context exists.

export async function logToolCall(
  agentName:  string,
  toolName:   string,
  args:       unknown,
  resultCode: string,
  ipHash?:    string,
): Promise<void> {
  await defer((async () => {
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
  })(), `audit:${toolName}`);
}
