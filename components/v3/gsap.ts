"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// ── GSAP registration singleton ─────────────────────────────────────────────
// Client-only. Registers ScrollTrigger + the official React hook exactly
// once per page load (module-level guard survives Fast Refresh remounts).
// Import from here, never straight from the packages, so every v3 component
// shares one registered instance. Free-tier GSAP + ScrollTrigger only — no
// Club GreenSock plugins (SplitText etc).
//
// useGSAP (not a hand-rolled useEffect + gsap.context) is deliberate: it uses
// an isomorphic layout effect so hidden-state `gsap.set()` calls apply before
// paint (no flash-of-visible-content), and it auto-reverts on unmount/
// StrictMode's double-invoke, which a plain useEffect cleanup doesn't
// guarantee against animation leaks.

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };
