"use client";

import { useCallback, useState } from "react";
import GlassSidebar, { DEFAULT_NAV_ITEMS, DEFAULT_UTILITY_ITEMS } from "@/components/v2/GlassSidebar";

// Demo bench: stands in for the real 3D canvas. The drifting gradients give
// the backdrop motion so the glass blur and separation are visible; the
// readout card logs every callback so the wiring contract is observable.

type LogLine = { t: string; msg: string };

const ALL_ITEMS = [...DEFAULT_NAV_ITEMS, ...DEFAULT_UTILITY_ITEMS];

export default function SidebarDemo() {
  const [view, setView] = useState(DEFAULT_NAV_ITEMS[0].id);
  const [expanded, setExpanded] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);

  const push = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLog((prev) => [{ t, msg }, ...prev].slice(0, 8));
  }, []);

  const handleNavigate = useCallback(
    (id: string) => {
      setView(id);
      push(`onNavigate("${id}") -> camera.flyTo("${id}")`);
    },
    [push],
  );

  const handleToggle = useCallback(
    (open: boolean) => {
      setExpanded(open);
      push(`onToggle(${open})`);
    },
    [push],
  );

  const activeLabel = ALL_ITEMS.find((i) => i.id === view)?.label ?? view;

  return (
    <>
    {/* in-flow spacer so the V2Frame footer sits below the fold, not behind the bench */}
    <div aria-hidden className="h-screen" />
    <div className="fixed inset-0 z-[55] overflow-hidden bg-[#07070b]">
      {/* mock 3D canvas: drifting nebulas + grid */}
      <style>{`
        @keyframes demoDriftA { from { transform: translate(-8%, -6%); } to { transform: translate(6%, 8%); } }
        @keyframes demoDriftB { from { transform: translate(10%, 4%); } to { transform: translate(-6%, -8%); } }
        @media (prefers-reduced-motion: reduce) {
          .demo-drift-a, .demo-drift-b { animation: none; }
        }
      `}</style>
      <div
        className="demo-drift-a pointer-events-none absolute -inset-1/4"
        style={{
          background:
            "radial-gradient(40% 35% at 35% 40%, rgba(34,211,238,0.10), transparent 70%)",
          animation: "demoDriftA 16s ease-in-out infinite alternate",
        }}
      />
      <div
        className="demo-drift-b pointer-events-none absolute -inset-1/4"
        style={{
          background:
            "radial-gradient(35% 40% at 70% 60%, rgba(193,72,38,0.10), transparent 70%)",
          animation: "demoDriftB 21s ease-in-out infinite alternate",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* the component under test */}
      <GlassSidebar activeId={view} onNavigate={handleNavigate} onToggle={handleToggle} />

      {/* readout card */}
      <div className="absolute right-6 top-24 w-[340px] max-w-[calc(100vw-8rem)] rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#E8714C]">
          GlassSidebar bench
        </p>
        <p className="mt-3 font-mono text-sm text-zinc-100" data-testid="active-view">
          view: <span className="text-cyan-300">{view}</span> ({activeLabel})
        </p>
        <p className="mt-1 font-mono text-sm text-zinc-100" data-testid="expanded-state">
          expanded: <span className="text-cyan-300">{String(expanded)}</span>
        </p>
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Callback log
          </p>
          <ul className="mt-2 flex flex-col gap-1" data-testid="event-log">
            {log.length === 0 && (
              <li className="font-mono text-xs text-zinc-600">
                Hover, pin, or click a nav item.
              </li>
            )}
            {log.map((line, i) => (
              <li key={`${line.t}-${i}`} className="font-mono text-xs text-zinc-400">
                <span className="text-zinc-600">{line.t}</span> {line.msg}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
    </>
  );
}
