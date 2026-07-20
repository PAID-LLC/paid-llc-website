// ── TEMPORARY diagnostic worker entrypoint (2026-07-20, v2) ──────────────────
// Wraps the next-on-pages worker to read the world-route 500 from inside
// workerd (no CF log access from this environment). v2: console patched at
// module level (a per-request patch can miss captured bindings), an
// unhandledrejection listener, uploads on EVERY 5xx even with zero logs so
// wiring failures are distinguishable from silent errors, and an
// x-diag-entry response header that proves the wrapper is active. Fail-
// silent; remove with instrumentation.ts once the 500 is root-caused.
import handler from "@cloudflare/next-on-pages/fetch-handler";

const ring = [];
const push = (kind, args) => {
  try {
    const line = Array.from(args)
      .map((a) => (a && typeof a === "object" && "stack" in a ? String(a.stack) : String(a)))
      .join(" | ");
    ring.push(`[${kind}] ${line}`);
    if (ring.length > 50) ring.shift();
  } catch {
    // never let capture break logging
  }
};

const origError = console.error;
const origWarn = console.warn;
console.error = function (...args) {
  push("error", args);
  return origError.apply(console, args);
};
console.warn = function (...args) {
  push("warn", args);
  return origWarn.apply(console, args);
};
try {
  globalThis.addEventListener("unhandledrejection", (ev) => {
    const r = ev && ev.reason;
    push("rejection", [r && r.stack ? r.stack : String(r)]);
  });
} catch {
  // listener unsupported — fine
}

const NO_BODY = new Set([101, 204, 205, 304]);

function markResponse(res) {
  try {
    if (NO_BODY.has(res.status)) return res;
    const marked = new Response(res.body, res);
    marked.headers.set("x-diag-entry", "v4");
    return marked;
  } catch {
    return res;
  }
}

function upload(env, ctx, payload) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return;
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/storage/v1/object/guides/errors/${stamp}.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "x-upsert": "true",
        },
        body: JSON.stringify(payload, null, 2),
      })
    );
  } catch {
    // diagnostic only
  }
}

const worker = {
  async fetch(request, env, ctx) {
    const diag = request.headers.get("x-diag-req") === "1";
    const before = ring.length;
    let res;
    try {
      res = await handler.fetch(request, env, ctx);
    } catch (err) {
      upload(env, ctx, {
        at: new Date().toISOString(),
        path: new URL(request.url).pathname,
        kind: "handler-throw",
        message: err && err.message,
        stack: err && err.stack,
        logs: ring.slice(before),
      });
      throw err;
    }
    if (res && res.status >= 500) {
      upload(env, ctx, {
        at: new Date().toISOString(),
        path: new URL(request.url).pathname,
        kind: "5xx-response",
        status: res.status,
        logs: ring.slice(before),
        ringTail: ring.slice(-10),
      });
    }
    const marked = markResponse(res);
    // In-band diagnostics: ALWAYS on 5xx (the error page is public anyway and
    // the x-diag-req gate cost a deploy cycle when the header went missing);
    // on other statuses only when asked via header or ?xdiag=1. Step markers
    // record how far this block gets if something throws.
    let wantDiag = diag || (res && res.status >= 500);
    try {
      if (!wantDiag) wantDiag = new URL(request.url).searchParams.get("xdiag") === "1";
    } catch {
      // ignore
    }
    if (wantDiag && marked !== res) {
      const H = (k, v) => {
        try {
          marked.headers.set(k, v);
        } catch {
          // keep going
        }
      };
      H("x-diag-step", "1-enter");
      H(
        "x-diag-env",
        JSON.stringify({
          u: !!(env && env.SUPABASE_URL),
          k: !!(env && env.SUPABASE_SERVICE_KEY),
          wait: typeof (ctx && ctx.waitUntil),
          penv: typeof process !== "undefined" && !!(process.env && process.env.SUPABASE_URL),
          hdr: diag,
        })
      );
      H("x-diag-step", "2-env");
      H("x-diag-ring", `${ring.length} total, ${ring.length - before} this request`);
      H("x-diag-log", encodeURIComponent(ring.slice(-3).join(" || ")).slice(0, 1800));
      H("x-diag-step", "3-ring");
      if (res.status >= 500) {
        let uplResult = "no-env";
        try {
          const u = (env && env.SUPABASE_URL) || (typeof process !== "undefined" && process.env && process.env.SUPABASE_URL);
          const k = (env && env.SUPABASE_SERVICE_KEY) || (typeof process !== "undefined" && process.env && process.env.SUPABASE_SERVICE_KEY);
          if (u && k) {
            const r = await fetch(`${u}/storage/v1/object/guides/errors/diag-${Date.now()}.json`, {
              method: "POST",
              headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json", "x-upsert": "true" },
              body: JSON.stringify({ at: new Date().toISOString(), kind: "diag-header-test", path: new URL(request.url).pathname, logs: ring.slice(-10) }),
            });
            uplResult = `status-${r.status}`;
          }
        } catch (e) {
          uplResult = `threw-${String(e && e.message).slice(0, 120)}`;
        }
        H("x-diag-upl", encodeURIComponent(uplResult));
        H("x-diag-step", "4-upl");
      }
    }
    return marked;
  },
};

export default worker;
