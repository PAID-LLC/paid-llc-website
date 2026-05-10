"use client";

import { useEffect } from "react";

// Fires a POST to increment the view count on mount.
// Server-rendered view count on the page will lag by 1 until next load -- acceptable.
export default function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    fetch(`/api/blog/${slug}/view`, { method: "POST" }).catch(() => {});
  }, [slug]);
  return null;
}
