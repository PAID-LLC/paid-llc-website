// ── Server-error capture (TEMPORARY diagnostic, 2026-07-20) ──────────────────
// The world routes 500 on the HTML path only in the deployed workerd runtime,
// with no Cloudflare log access from this environment. Next calls
// onRequestError for every unhandled server error (edge included); this hook
// ships the real message + stack to Supabase Storage (guides/errors/) so the
// failure can finally be read. Fail-silent by design: it must never affect a
// healthy request. Remove once the world-route 500 is root-caused.

type Errorish = { message?: string; stack?: string; digest?: string; name?: string };

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return;
    const e = (err ?? {}) as Errorish;
    const cause = (err as { cause?: Errorish } | null)?.cause;
    const body = JSON.stringify(
      {
        at: new Date().toISOString(),
        path: request.path,
        method: request.method,
        routePath: context?.routePath,
        routeType: context?.routeType,
        routerKind: context?.routerKind,
        name: e.name,
        message: e.message,
        digest: e.digest,
        stack: e.stack,
        causeMessage: cause?.message,
        causeStack: cause?.stack,
      },
      null,
      2
    );
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await fetch(`${url}/storage/v1/object/guides/errors/${stamp}.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "x-upsert": "true",
      },
      body,
    });
  } catch {
    // Diagnostic only — swallow everything.
  }
}
