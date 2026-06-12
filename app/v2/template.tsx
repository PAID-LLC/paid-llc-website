"use client";

// ── v2 page transition (wow audit Tier 1.4) ─────────────────────────────────
// A template re-mounts on every route change within the segment, so the enter
// animation plays on each v2 navigation: content rises 8px and fades in while
// a cyan sweep crosses the top edge. Paired with the cross-document
// @view-transition rule in globals (covers hard navigations); React's
// unstable_ViewTransition is skipped deliberately — it requires canary React,
// which this production build does not run.
//
// prefers-reduced-motion users see content immediately (animation: none).

export default function V2Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="v2-page-enter">
      <style>{`
        .v2-page-enter {
          animation: v2PageEnter 0.38s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .v2-page-enter::before {
          content: "";
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 1.5px;
          z-index: 60;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(232,113,76,0.9), transparent);
          animation: v2PageSweep 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes v2PageEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes v2PageSweep {
          from { transform: translateX(-100%); opacity: 1; }
          70%  { opacity: 1; }
          to   { transform: translateX(100%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .v2-page-enter, .v2-page-enter::before { animation: none; }
          .v2-page-enter::before { display: none; }
        }
      `}</style>
      {children}
    </div>
  );
}
