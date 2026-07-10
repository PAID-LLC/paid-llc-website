"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseStore } from "./useUniverseStore";

// Runs every frame but only moves the camera while a world is selected — the
// hub overview hands the camera to <OrbitControls> instead (see
// UniverseCanvas, which disables OrbitControls exactly when this is active,
// the same handoff LoungeCanvas's FollowCamera/OrbitControls pair already
// uses). Reads the store via getState() rather than a selector so this
// component never re-renders on its own; it only ever writes to the camera.
export default function CameraRig() {
  const { camera } = useThree();
  const lookTarget = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());

  useFrame(() => {
    const { currentWorldId, worlds } = useUniverseStore.getState();
    const node = currentWorldId != null ? worlds.find((w) => w.id === currentWorldId) : null;
    if (!node) return;

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
  });

  return null;
}
