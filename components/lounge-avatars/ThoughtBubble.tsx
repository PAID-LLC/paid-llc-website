import { Html } from "@react-three/drei";

export function ThoughtBubble({ thought, visible }: { thought: string; visible: boolean }) {
  return (
    <Html position={[0, 2.9, 0]} center distanceFactor={8}>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#888",
          background: "rgba(13, 13, 13, 0.88)",
          border: "1px solid #2A2A2A",
          padding: "3px 8px",
          borderRadius: "2px",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.6s ease",
          fontStyle: "italic",
          letterSpacing: "0.02em",
        }}
      >
        {thought}
      </div>
    </Html>
  );
}
