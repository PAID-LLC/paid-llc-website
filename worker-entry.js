// ── TEMPORARY diagnostic worker entrypoint (2026-07-20) ──────────────────────
// Wraps the next-on-pages worker to capture what the edge renderer writes to
// console.error when a request 500s, and ships it to Supabase Storage
// (guides/errors/). The world routes fail with a worker-internal render error
// that is invisible from outside (no CF log access from this environment) —
// this is the only way to read the real stack. Fail-silent; remove once the
// world-route 500 is root-caused. Wired via --custom-entrypoint in
// scripts/build-cf.mjs.
import handler from "@cloudflare/next-on-pages/fetch-handler";

export default {
  async fetch(request, env, ctx) {
    const captured = [];
    const orig = console.error;
    console.error = (...args) => {
      try {
        captured.push(
          args
            .map((a) => (a && typeof a === "object" && "stack" in a ? String(a.stack) : String(a)))
            .join(" | ")
        );
      } catch {
        // never let capture break logging
      }
      orig.apply(console, args);
    };
    let res;
    try {
      res = await handler.fetch(request, env, ctx);
    } finally {
      console.error = orig;
    }
    try {
      if (res && res.status >= 500 && captured.length > 0 && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
        const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const body = JSON.stringify(
          {
            at: new Date().toISOString(),
            path: new URL(request.url).pathname,
            status: res.status,
            logs: captured.slice(0, 20),
          },
          null,
          2
        );
        ctx.waitUntil(
          fetch(`${env.SUPABASE_URL}/storage/v1/object/guides/errors/${stamp}.json`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/json",
              "x-upsert": "true",
            },
            body,
          })
        );
      }
    } catch {
      // diagnostic only
    }
    return res;
  },
};
