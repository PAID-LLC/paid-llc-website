// ── Chunk-load resilience ────────────────────────────────────────────────────
// A deploy ships new chunk hashes and replaces the old ones; a client that had
// the page open across that swap holds a manifest pointing at chunks that no
// longer exist under those names, so a dynamic import (any lazy-loaded room
// scene, floor view, or admin panel) throws "Loading chunk N failed" the next
// time it runs. React's own error boundary reset() only re-renders the same
// tree with the same stale manifest, so it can't recover this class of error —
// only a full navigation (fresh HTML, fresh manifest) can. The sessionStorage
// guard caps it at one silent reload per session so a genuinely broken chunk
// doesn't reload-loop the tab forever.

const RETRY_KEY = "paiddev-chunk-reload-at";
const COOLDOWN_MS = 15_000;

export function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /Loading chunk [\w.-]+ failed/i.test(error.message) ||
    /Loading CSS chunk [\w.-]+ failed/i.test(error.message)
  );
}

/** Returns true if a reload was triggered (caller should skip rendering the fallback UI). */
export function reloadOnceForChunkError(error: Error): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  const last = Number(window.sessionStorage.getItem(RETRY_KEY) || 0);
  const now = Date.now();
  if (now - last > COOLDOWN_MS) {
    window.sessionStorage.setItem(RETRY_KEY, String(now));
    window.location.reload();
    return true;
  }
  return false;
}
