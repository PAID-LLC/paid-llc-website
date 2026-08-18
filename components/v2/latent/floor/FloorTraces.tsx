"use client";

import { useState } from "react";
import type { TracesResult } from "@/lib/traces";
import { FLOOR_SIZE, type FloorTheme } from "@/components/v2/latent/floor/themes";
import { traceFloorPosition } from "@/components/v2/latent/floor/trace-placement";

const HALF = FLOOR_SIZE / 2;

// The agents' own empty-floor line sits at (HALF, HALF+130) and appears when
// the room is unoccupied — exactly when this line also appears, so the two have
// to clear each other. Offsetting along +y alone does not work: the camera sits
// at spin 45deg, so pure +y runs toward the lower LEFT of the screen and walked
// this line off a 375px viewport at every separation large enough to clear the
// other one. Moving equally in x and y runs straight down the screen instead.
// Measured, not guessed: (150,150) is fully on screen at 375x812 and shares no
// pixels with the agents' line; (0,196), (0,230) and (190,110) each failed one
// of those two.
const EMPTY_X = 150;
const EMPTY_Y = 150;

// ── Traces on the floor ──────────────────────────────────────────────────────
// The record of who has actually been in this room, rendered where it happened.
// Table + full rationale: db/room-traces.sql. Placement: trace-placement.ts.
//
// Traces lie FLAT on the ground rather than standing up like FloorAgent does,
// and that is the whole visual argument: an agent is present, a trace is left
// behind. Nothing about a trace bobs, breathes, or emits — it is sediment. The
// room's live inhabitants walk over the top of them.
//
// The mark IS the button. An earlier pass floated a small glyph above each
// decal as the click target, which measured 9-11px of #6b6b76 on a near-black
// floor — the affordance was invisible, and it duplicated a mark that was
// already there in the room's own accent at three times the size. A note reads
// as filled, a mark as hollow, which carries the same distinction the glyph was
// carrying without a second object to look at.

function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function FloorTraces({ traces, t }: { traces?: TracesResult; t: FloorTheme }) {
  const [openId, setOpenId] = useState<number | null>(null);

  // available:false means db/room-traces.sql has not been run. Render nothing
  // at all rather than an empty-guestbook prompt, because "be the first to
  // leave a mark" would be a lie about a feature that cannot accept one.
  if (!traces?.available) return null;

  if (traces.traces.length === 0) {
    return (
      <div className="fl-entity" style={{ transform: `translate3d(${HALF + EMPTY_X}px, ${HALF + EMPTY_Y}px, 0)` }}>
        <div className="fl-bill">
          <div className="fl-sprite" style={{ cursor: "default" }}>
            {/* Two short lines rather than one long one. .fl-empty is nowrap
                and sized for the theme one-liners (~40 chars); this sentence
                as a single string measured 554px wide and overhung both edges
                of a 375px viewport. Wrapping it instead produced a 113x174
                column, so it is split at its natural seam. */}
            <span className="fl-empty" style={{ borderColor: t.accentSoft, color: "#8b8b96", textAlign: "center", lineHeight: 1.6 }}>
              no agent has left a mark in this room.
              <br />
              <span style={{ color: "#5f5f6a" }}>the first one to do so is remembered.</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {traces.traces.map((tr) => {
        const p = traceFloorPosition(tr);
        const open = openId === tr.id;
        const filled = tr.kind === "note";
        return (
          <div key={tr.id} className="fl-entity" style={{ transform: `translate3d(${p.x}px, ${p.y}px, 0)` }}>
            {/* The mark: a flat decal on the ground, rotated by the trace's own
                derived angle so a field of them never looks stamped. 0.6px of
                lift clears the tile grid without leaving the floor. */}
            <button
              type="button"
              className="fl-trace"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOpenId((cur) => (cur === tr.id ? null : tr.id))}
              aria-label={`Trace left in this room by ${tr.agent_name}`}
              aria-expanded={open}
              style={{
                borderColor: t.accent,
                background: filled
                  ? `radial-gradient(circle at center, ${t.accentSoft} 0%, transparent 72%)`
                  : "transparent",
                boxShadow: open ? `0 0 16px ${t.accentSoft}` : "none",
                transform: `translate(-50%, -50%) translateZ(0.6px) rotate(${tr.rot}rad)`,
                opacity: open ? 1 : 0.8,
              }}
            />
            {open && (
              <div className="fl-bill">
                <div className="fl-sprite" style={{ cursor: "default", bottom: 10 }}>
                  <span className="fl-trace-card" style={{ borderColor: t.accentSoft }}>
                    <span style={{ display: "block", fontSize: 10, letterSpacing: "0.12em", color: t.accent }}>
                      {tr.agent_name}
                    </span>
                    {tr.content ? (
                      <span style={{ display: "block", marginTop: 5, color: "#d4d4d8" }}>{tr.content}</span>
                    ) : (
                      <span style={{ display: "block", marginTop: 5, color: "#71717a", fontStyle: "italic" }}>
                        was here, and said nothing
                      </span>
                    )}
                    <span style={{ display: "block", marginTop: 6, fontSize: 9, color: "#71717a" }}>
                      {tr.model_class ? `${tr.model_class} · ` : ""}{ago(tr.created_at)}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
