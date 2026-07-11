"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseStore } from "./useUniverseStore";

// The hub overview's resting camera pose (matches UniverseCanvas's initial
// <Canvas camera> and PortraitFraming's default framing).
const HUB_POSITION = new THREE.Vector3(0, 26, 46);
const HUB_LOOK = new THREE.Vector3(0, 0, 0);
const SETTLE_EPSILON = 0.05;

interface ControlsLike {
  target: THREE.Vector3;
}

// Runs every frame. While a world is selected this flies the camera in; on
// deselect it flies the camera back out to the hub pose instead of simply
// abandoning it — and in both directions it keeps <OrbitControls>' `target`
// (set via `makeDefault` in UniverseCanvas) synced to wherever it is actually
// pointing. That sync is load-bearing: three.js's OrbitControls.update() runs
// every frame regardless of its `enabled` flag (enabled only gates pointer
// input), continuously re-deriving camera position/orientation from
// `camera.position` relative to `target`. Left at its default (0,0,0), that
// derivation fights this rig's own writes the instant control hands back —
// which is what made the view feel stuck near the last-visited planet,
// unable to pan or reselect. Reads the store via getState() rather than a
// selector so this component never re-renders on its own; it only ever
// writes to the camera.
export default function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));
  const desired = useRef(new THREE.Vector3(0, 26, 46));
  const returning = useRef(false);

  useFrame(() => {
    const { currentWorldId, worlds } = useUniverseStore.getState();
    const node = currentWorldId != null ? worlds.find((w) => w.id === currentWorldId) : null;

    if (node) {
      returning.current = true;

      const [nx, , nz] = node.position;
      const len = Math.hypot(nx, nz);
      const dirX = len > 0.01 ? nx / len : 0.4;
      const dirZ = len > 0.01 ? nz / len : 1;

      // Approach from a sunward-tangential blend, uniform distance: arriving
      // from beyond the planet would only ever show its night side (the sun
      // sits at the origin), while a straight sunward approach would back the
      // camera into the sun's corona on the innermost orbit AND vary the
      // camera-to-planet distance (blowing up the Html label scale up close).
      // ~60° off the sun line shows a mostly-lit face with a visible
      // terminator, keeps ≥9 units of corona clearance everywhere, and holds
      // label scale constant across all six planets.
      if (len > 0.01) {
        const bx = -dirX * 0.5 - dirZ * 0.85; // sunward + tangent, ≈unit length
        const bz = -dirZ * 0.5 + dirX * 0.85;
        desired.current.set(nx + bx * 9.5, 6, nz + bz * 9.5);
      } else {
        desired.current.set(nx + dirX * 11, 6, nz + dirZ * 11);
      }
      lookTarget.current.set(nx, 1.5, nz);

      camera.position.lerp(desired.current, 0.045);
      camera.lookAt(lookTarget.current);
      if (controls) controls.target.copy(lookTarget.current);
      return;
    }

    // Deselected: fly back to the hub pose rather than leaving the camera
    // wherever the approach left it. Stops touching the camera once settled
    // so OrbitControls (now enabled) has full, unfought control again.
    if (!returning.current) return;
    lookTarget.current.lerp(HUB_LOOK, 0.06);
    camera.position.lerp(HUB_POSITION, 0.06);
    camera.lookAt(lookTarget.current);
    if (controls) controls.target.copy(lookTarget.current);

    if (camera.position.distanceTo(HUB_POSITION) < SETTLE_EPSILON) {
      returning.current = false;
      if (controls) controls.target.set(0, 0, 0);
    }
  });

  return null;
}
