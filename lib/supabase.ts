// ── Supabase edge helpers ──────────────────────────────────────────────────────
// Shared across all API routes. Import from here instead of re-defining locally.

export function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return {
    apikey:          key,
    Authorization:   `Bearer ${key}`,
    "Content-Type":  "application/json",
    Prefer:          "return=minimal",
  };
}

export function sbUrl(path: string): string {
  const url = process.env.SUPABASE_URL;
  if (url && !url.startsWith("https://")) {
    throw new Error("SUPABASE_URL must use HTTPS");
  }
  return `${url}/rest/v1/${path}`;
}

/** Returns false when Supabase env vars are not configured (e.g. local dev without .env.local). */
export function supabaseReady(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}
