"use client";

import { useEffect, useState } from "react";
import { reloadOnceForChunkError } from "@/lib/chunk-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Same stale-manifest problem as app/error.tsx, one layer higher (errors
  // thrown from the root layout itself land here instead).
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (reloadOnceForChunkError(error)) setReloading(true);
  }, [error]);

  if (reloading) return <html><body /></html>;

  return (
    <html>
      <body style={{ padding: "48px 24px", fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ color: "#1a1a1a", marginBottom: 12 }}>Something went wrong</h2>
        <p style={{ color: "#666", marginBottom: 8 }}>{error.message}</p>
        {error.digest && (
          <p style={{ color: "#999", fontSize: 12, marginBottom: 24 }}>Digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          style={{ background: "#c14826", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 4, cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
