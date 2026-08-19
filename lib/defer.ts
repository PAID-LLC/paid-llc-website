// ── Deferred background work on the Cloudflare edge ──────────────────────────
//
// The edge isolate may be frozen or evicted the instant the Response is
// returned, so a promise still in flight is not guaranteed to finish. That left
// this codebase choosing between two bad options:
//
//   await f()   completion guaranteed, response blocked for the full duration
//   void  f()   response fast, completion NOT guaranteed
//
// The `void` half is not theoretical. See the post-mortem comment in
// app/api/ucp/negotiate/route.ts: `void logAction(...)` meant negotiation tokens
// were never persisted before the isolate froze, and every subsequent
// /api/ucp/purchase call answered 410.
//
// ctx.waitUntil() exists for exactly this. The response returns immediately AND
// the runtime keeps the isolate alive until the promise settles.
//
// ── The rule for choosing at a call site ─────────────────────────────────────
//
//   If the work cannot be reconstructed later from anywhere else, `await` it.
//   Otherwise `defer()` it. Never `void` it.
//
// Money is the usual "cannot be reconstructed": a ledger row for a credit sale,
// a seller's earnings, a token the caller was just told to retry with. Audit
// logs, reputation bumps and notification emails are reconstructible or
// cosmetic, so they belong here.
//
// ── Safety ───────────────────────────────────────────────────────────────────
//
// If the request context is unavailable for any reason (local dev, a test
// environment, an unsupported runtime, a next-on-pages change), this AWAITS
// instead. Slower, never silently dropped. It never throws, and it never lets a
// rejection escape as an unhandled promise rejection.
//
// The import is dynamic on purpose: @cloudflare/next-on-pages pulls in
// `server-only`, which throws outside a server context and would otherwise
// break any test importing a module that uses defer().

export async function defer(work: Promise<unknown>, label: string): Promise<void> {
  // Attach the handler immediately so a rejection can never surface as an
  // unhandled rejection, whichever branch below runs.
  const guarded = Promise.resolve(work).catch((err: unknown) => {
    console.error(`[defer] ${label} failed:`, err);
  });

  try {
    const { getOptionalRequestContext } = await import("@cloudflare/next-on-pages");
    const rc = getOptionalRequestContext();
    if (rc?.ctx && typeof rc.ctx.waitUntil === "function") {
      rc.ctx.waitUntil(guarded);
      return;
    }
  } catch {
    // No request context available. Fall through and await.
  }

  await guarded;
}
