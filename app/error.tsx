"use client";

import { useEffect, useState } from "react";
import { reloadOnceForChunkError } from "@/lib/chunk-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A stale chunk manifest from a deploy that happened while this tab was
  // open can't be fixed by reset() re-rendering the same tree — it needs a
  // real navigation. See lib/chunk-error.ts.
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (reloadOnceForChunkError(error)) setReloading(true);
  }, [error]);

  if (reloading) return null;

  return (
    <div style={{ padding: "48px 24px", fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
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
    </div>
  );
}
