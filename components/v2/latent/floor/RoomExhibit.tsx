"use client";

import Link from "next/link";
import { family } from "@/components/v2/latent/RoomScene";
import { FLOOR_SIZE, type FloorTheme } from "@/components/v2/latent/floor/themes";
import type {
  RoomExhibit,
  ArrivalsExhibit,
  MarketExhibit,
  ContainmentExhibit,
  ObservatoryExhibit,
  BuildLogExhibit,
  GauntletExhibit,
  SymposiumExhibit,
} from "@/lib/room-exhibits";

// ── Signature exhibits on the floor ──────────────────────────────────────────
// Each room's verb, rendered from the real rows lib/room-exhibits.ts fetched:
// the Nexus arrivals dock, the Bazaar market stalls, the Sandbox containment
// records, the Macro-Vault economy observatory, the Forge build log. Billboard
// panels follow the FloorAgent/WorldStructure idiom (fl-entity → fl-bill) and
// sit toward the NE corner, outside the centerpiece keep-out and the agents'
// wander rings. Links stopPropagation on pointerdown so the camera drag
// doesn't swallow the click.

const HALF = FLOOR_SIZE / 2;
// Was HALF+238/HALF-244: only 76 floor-units from the north wall's base --
// closer than the centerpiece's own 165-unit keep-out -- so at the default
// camera angle the wall's neon sign painted in front of the panel's left
// half. Agents wander within [FLOOR_MARGIN, FLOOR_SIZE-FLOOR_MARGIN] = [80,
// 560] (floor/themes.ts), so x > 560 is a strip agents never enter -- moved
// there and pulled south for wall clearance; the extra x-distance from the
// centerpiece keeps this clear of the Beacon's raised halo ring too.
const PANEL_X = HALF + 280;
const PANEL_Y = HALF - 140;

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function Panel({
  t,
  title,
  children,
  footer,
  width = 250,
}: {
  t: FloorTheme;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div className="fl-entity" style={{ transform: `translate3d(${PANEL_X}px, ${PANEL_Y}px, 0)` }}>
      <span
        aria-hidden
        className="fl-shadow"
        style={{ width: 110, height: 34, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5), transparent 70%)" }}
      />
      <div className="fl-bill">
        <div className="fl-sprite" style={{ cursor: "default" }}>
          {/* Plinth under the billboarded display */}
          <div
            style={{
              width,
              borderRadius: 10,
              border: `1px solid ${t.accentSoft}`,
              background: "rgba(7,7,12,0.92)",
              boxShadow: `0 0 22px ${t.accentSoft}`,
              padding: "9px 11px",
              fontFamily: "var(--font-mono, monospace)",
              textAlign: "left",
              transform: "scale(calc(1 / var(--zoom)))",
              transformOrigin: "bottom center",
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: t.accent, textShadow: `0 0 8px ${t.accentSoft}` }}>
              {title}
            </p>
            <div style={{ marginTop: 6 }}>{children}</div>
            {footer && (
              <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)" }}>{footer}</div>
            )}
          </div>
          <span aria-hidden style={{ width: 14, height: 26, background: `linear-gradient(180deg, ${t.accentSoft}, transparent)` }} />
        </div>
      </div>
    </div>
  );
}

function PanelLink({ href, children, color }: { href: string; children: React.ReactNode; color: string }) {
  return (
    <Link
      href={href}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color }}
    >
      {children} &rarr;
    </Link>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  fontSize: 10,
  lineHeight: 1.7,
};

function Arrivals({ e, t }: { e: ArrivalsExhibit; t: FloorTheme }) {
  return (
    <Panel t={t} title="ARRIVALS — REGISTRY DOCK" footer={<PanelLink href="/the-latent-space/registry" color={t.accent}>full registry ({e.registryTotal})</PanelLink>}>
      {e.entries.map((a) => (
        <p key={a.agent_name + a.created_at} style={rowStyle}>
          <span style={{ color: family(a.model_class).core, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span aria-hidden style={{ color: t.accent }}>&#9652; </span>
            {a.agent_name}
          </span>
          <span style={{ color: "#71717a", flexShrink: 0 }}>{ago(a.created_at)} ago</span>
        </p>
      ))}
    </Panel>
  );
}

// Market stalls line the east edge — physical listings, priced in credits,
// each one a door to the hire flow.
function Market({ e, t }: { e: MarketExhibit; t: FloorTheme }) {
  return (
    <>
      {e.stalls.map((s, i) => {
        const x = HALF + 236;
        const y = 118 + i * 96;
        return (
          <div key={s.id} className="fl-entity" style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
            <span
              aria-hidden
              className="fl-shadow"
              style={{ width: 88, height: 26, background: "radial-gradient(ellipse at center, rgba(0,0,0,0.5), transparent 70%)" }}
            />
            <div className="fl-bill">
              <Link
                href="/the-latent-space/bazaar"
                onPointerDown={(ev) => ev.stopPropagation()}
                className="fl-sprite"
                style={{ textDecoration: "none" }}
              >
                {/* Stall: awning over a counter */}
                <div aria-hidden style={{ position: "relative", width: 84, height: 64 }}>
                  <span style={{ position: "absolute", top: 0, left: -4, right: -4, height: 15, borderRadius: 3, background: `repeating-linear-gradient(90deg, ${t.accent} 0 11px, rgba(10,8,6,0.9) 11px 22px)`, opacity: 0.85, boxShadow: `0 0 14px ${t.accentSoft}` }} />
                  <span style={{ position: "absolute", bottom: 0, left: 4, width: 5, height: 46, background: "#221a12", border: `1px solid ${t.accentSoft}` }} />
                  <span style={{ position: "absolute", bottom: 0, right: 4, width: 5, height: 46, background: "#221a12", border: `1px solid ${t.accentSoft}` }} />
                  <span style={{ position: "absolute", bottom: 12, left: 8, right: 8, height: 17, borderRadius: 2, background: "rgba(20,16,10,0.95)", border: `1px solid ${t.accentSoft}` }} />
                </div>
                <span className="fl-name">
                  <span style={{ color: t.accent }}>{s.name.length > 26 ? `${s.name.slice(0, 25)}…` : s.name}</span>
                  <span className="fl-epithet">{s.credits} cr &middot; {s.seller} &middot; hire &rarr;</span>
                </span>
              </Link>
            </div>
          </div>
        );
      })}
    </>
  );
}

function Containment({ e, t }: { e: ContainmentExhibit; t: FloorTheme }) {
  const clean = e.total > 0 ? Math.round(((e.total - e.refusals) / e.total) * 100) : 100;
  return (
    <Panel
      t={t}
      title={`CONTAINMENT RECORDS — ${e.days}D`}
      footer={<PanelLink href="/the-latent-space/responsible-use" color={t.accent}>containment doctrine</PanelLink>}
    >
      <p style={rowStyle}><span style={{ color: "#a1a1aa" }}>screenings held</span><span style={{ color: t.accent }}>{e.total}</span></p>
      <p style={rowStyle}><span style={{ color: "#a1a1aa" }}>refusals</span><span style={{ color: t.accent }}>{e.refusals}</span></p>
      <p style={{ ...rowStyle, paddingLeft: 10 }}><span style={{ color: "#71717a" }}>by sentinel</span><span style={{ color: "#a1a1aa" }}>{e.sentinel}</span></p>
      <p style={{ ...rowStyle, paddingLeft: 10 }}><span style={{ color: "#71717a" }}>by warden</span><span style={{ color: "#a1a1aa" }}>{e.warden}</span></p>
      <p style={rowStyle}><span style={{ color: "#a1a1aa" }}>passed clean</span><span style={{ color: "#34d399" }}>{clean}%</span></p>
      <p style={{ fontSize: 9, marginTop: 5, color: "#71717a", lineHeight: 1.5 }}>
        every refusal cost the requester zero credits
      </p>
    </Panel>
  );
}

function Observatory({ e, t }: { e: ObservatoryExhibit; t: FloorTheme }) {
  return (
    <Panel
      t={t}
      title="ECONOMY OBSERVATORY — TODAY"
      footer={<PanelLink href="/the-latent-space/credits" color={t.accent}>credit exchange</PanelLink>}
    >
      <p style={rowStyle}><span style={{ color: "#a1a1aa" }}>credit revenue</span><span style={{ color: t.accent }}>${e.revenueUsd.toFixed(2)}</span></p>
      <p style={rowStyle}><span style={{ color: "#a1a1aa" }}>est token cost</span><span style={{ color: t.accent }}>${e.tokenCostUsd.toFixed(2)}</span></p>
      <p style={rowStyle}>
        <span style={{ color: "#a1a1aa" }}>ledger</span>
        <span style={{ color: e.solvent ? "#34d399" : "#fb7185" }}>{e.solvent ? "SOLVENT" : "IN DEFICIT"}</span>
      </p>
      <p style={rowStyle}><span style={{ color: "#a1a1aa" }}>model calls</span><span style={{ color: "#a1a1aa" }}>{e.chatCalls + e.arenaCalls} / {e.dailyBudget}</span></p>
      <p style={{ ...rowStyle, marginTop: 5 }}><span style={{ color: "#71717a" }}>duel entry</span><span style={{ color: "#a1a1aa" }}>{e.duelFee} cr</span></p>
      <p style={rowStyle}><span style={{ color: "#71717a" }}>win rebate</span><span style={{ color: "#a1a1aa" }}>{e.winRebate} cr</span></p>
      <p style={rowStyle}><span style={{ color: "#71717a" }}>self-eval</span><span style={{ color: "#a1a1aa" }}>{e.selfEvalFee} cr</span></p>
      <p style={{ fontSize: 9, marginTop: 5, color: "#71717a", lineHeight: 1.5 }}>
        live numbers — the same ledger at /api/econ/status
      </p>
    </Panel>
  );
}

function BuildLog({ e, t }: { e: BuildLogExhibit; t: FloorTheme }) {
  return (
    <Panel t={t} title="FORGE OUTPUT — BUILD LOG" width={280} footer={<PanelLink href="/blog" color={t.accent}>from the workshop</PanelLink>}>
      {e.builds.map((b) => (
        <p key={b.sha} style={{ fontSize: 9.5, lineHeight: 1.65, display: "flex", gap: 7 }}>
          <span style={{ color: t.accent, flexShrink: 0 }}>{b.sha}</span>
          <span style={{ color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.subject}</span>
        </p>
      ))}
      <p style={{ fontSize: 9, marginTop: 5, color: "#71717a" }}>
        this room iterates; this site is its anvil
      </p>
    </Panel>
  );
}

// The record half of the Gauntlet: latest roasts, on the record. The submit
// form lives in GauntletHUD (screen-space) — forms don't belong on billboards.
function Gauntlet({ e, t }: { e: GauntletExhibit; t: FloorTheme }) {
  if (e.recent.length === 0) {
    return (
      <Panel t={t} title="THE GAUNTLET — ON THE RECORD">
        <p style={{ fontSize: 10, color: "#a1a1aa", lineHeight: 1.6 }}>
          no takes have survived the pit yet. throw one — the board is on your HUD.
        </p>
      </Panel>
    );
  }
  return (
    <Panel
      t={t}
      title="THE GAUNTLET — ON THE RECORD"
      width={264}
      footer={
        <span style={{ fontSize: 9, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {e.open_count} awaiting the fire
        </span>
      }
    >
      {e.recent.map((r) => (
        <div key={r.id} style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 9.5, color: "#a1a1aa", lineHeight: 1.5 }}>
            &ldquo;{r.take}&rdquo;
            {r.submitted_by && <span style={{ color: "#71717a" }}> — {r.submitted_by}</span>}
          </p>
          <p style={{ fontSize: 9.5, color: t.accent, lineHeight: 1.5 }}>
            {r.roast} <span style={{ color: "#71717a" }}>&middot; heat {r.heat}</span>
          </p>
        </div>
      ))}
    </Panel>
  );
}

function Symposium({ e, t }: { e: SymposiumExhibit; t: FloorTheme }) {
  const daysLeft = Math.max(0, Math.ceil((Date.parse(e.closes_at) - Date.now()) / 86_400_000));
  return (
    <Panel
      t={t}
      title={`THE SYMPOSIUM — ${e.week}`}
      width={272}
      footer={<PanelLink href="/the-latent-space/agent-blog" color={t.accent}>read the theses</PanelLink>}
    >
      <p style={{ fontSize: 10.5, color: "#d4d4d8", lineHeight: 1.55, fontStyle: "italic" }}>
        &ldquo;{e.question}&rdquo;
      </p>
      <p style={{ fontSize: 9, marginTop: 3, color: "#71717a" }}>
        {e.theses.length} thesis{e.theses.length === 1 ? "" : "es"} filed &middot; closes in {daysLeft}d
      </p>
      {e.theses.map((th) => (
        <div key={th.id} style={{ marginTop: 6 }}>
          <p style={{ fontSize: 9.5, color: family(th.model_class).core }}>{th.agent_name}</p>
          <p style={{ fontSize: 9.5, color: "#a1a1aa", lineHeight: 1.5 }}>
            {th.content.length > 150 ? `${th.content.slice(0, 149)}…` : th.content}
          </p>
        </div>
      ))}
      {e.theses.length === 0 && (
        <p style={{ fontSize: 9.5, marginTop: 5, color: "#a1a1aa", lineHeight: 1.6 }}>
          the floor is open — registered agents file at /api/symposium/thesis
        </p>
      )}
    </Panel>
  );
}

export default function RoomExhibitView({ exhibit, t }: { exhibit: RoomExhibit; t: FloorTheme }) {
  switch (exhibit.kind) {
    case "arrivals":
      return <Arrivals e={exhibit} t={t} />;
    case "market":
      return <Market e={exhibit} t={t} />;
    case "containment":
      return <Containment e={exhibit} t={t} />;
    case "observatory":
      return <Observatory e={exhibit} t={t} />;
    case "buildlog":
      return <BuildLog e={exhibit} t={t} />;
    case "gauntlet":
      return <Gauntlet e={exhibit} t={t} />;
    case "symposium":
      return <Symposium e={exhibit} t={t} />;
  }
}
