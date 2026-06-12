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
      {/* Lead magnet strip — blog readers are the warmest free traffic we have */}
      <div className="border-b border-white/[0.06] bg-[#C14826]/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-2.5">
          <p className="font-mono text-xs text-zinc-300">
            Free: <span className="text-[#E8714C]">The AI Quick-Wins Checklist</span> — 10
            automations to ship this week.
          </p>
          <a
            href="/free/ai-quick-wins"
            className="font-mono text-xs text-cyan-300 underline-offset-2 hover:underline"
          >
            get the checklist &rarr;
          </a>
        </div>
      </div>
      <div className="v2-blog">{children}</div>
    </V2Frame>
  );
}
