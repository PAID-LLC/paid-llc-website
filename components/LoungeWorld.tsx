"use client";

import { Grid } from "@react-three/drei";

export default function LoungeWorld() {
  return (
    <>
      {/* Background color */}
      <color attach="background" args={["#0D0D0D"]} />

      {/* Fog -- keep density low so distant agents aren't swallowed by the background */}
      <fogExp2 attach="fog" args={["#0D0D0D", 0.012]} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <pointLight position={[0, 12, 0]} intensity={1.2} color="#4A9ECC" />
      <pointLight position={[-12, 4, -12]} intensity={0.8} color="#C14826" />
      <pointLight position={[12, 4, 12]} intensity={0.8} color="#6B3FA0" />
      <pointLight position={[12, 4, -12]} intensity={0.4} color="#2A7A4A" />

      {/* Floor grid */}
      <Grid
        position={[0, 0, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1A2A1A"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#0D3A1A"
        fadeDistance={28}
        fadeStrength={1.2}
        followCamera={false}
        infiniteGrid={false}
      />
    </>
  );
}
