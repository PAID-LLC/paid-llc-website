import V2Frame from "@/components/v2/V2Frame";

// ── Blog in the v2 frame ─────────────────────────────────────────────────────
// First v1 segment migrated to the v2 look (Travis, 2026-06-12: brand
// whiplash clicking Blog from the dark v2 nav). The pages themselves still
// use v1 utility classes; the .v2-blog skin in globals.css remaps them to the
// dark palette so index, category, archive, and article pages convert at
// once. Full component rebuild happens in the promotion pass.
//
// NOTE: no robots/noindex here — blog stays fully indexed. The v2 frame is
// presentation only.

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <V2Frame>
      <div className="v2-blog">{children}</div>
    </V2Frame>
  );
}
