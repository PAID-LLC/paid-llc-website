"use client";

import { useRef, useEffect } from "react";
import type { CallState } from "@/lib/my3sons-types";

interface Props {
  analyser: AnalyserNode | null;
  state: CallState;
}

const BAR_COUNT = 28;
const IDLE_HEIGHTS = [4, 6, 5, 8, 5, 6, 4, 5, 7, 5, 4, 6, 8, 6, 4, 5, 7, 5, 6, 4, 8, 5, 6, 4, 5, 7, 5, 4];

export default function AudioWaveform({ analyser, state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 128);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      if (!canvas || !ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const barW = Math.floor(W / BAR_COUNT) - 2;
      phaseRef.current += 0.04;

      for (let i = 0; i < BAR_COUNT; i++) {
        let height: number;

        if (analyser && (state === "listening" || state === "speaking")) {
          analyser.getByteFrequencyData(dataArray);
          const step = Math.floor(dataArray.length / BAR_COUNT);
          const raw = dataArray[i * step] ?? 0;
          height = Math.max(3, (raw / 255) * (H - 4));
        } else if (state === "connected") {
          // Gentle idle pulse
          height = 6 + Math.sin(phaseRef.current + i * 0.4) * 4;
        } else if (state === "connecting") {
          // Loading wave
          height = 10 + Math.sin(phaseRef.current * 2 + i * 0.5) * 8;
        } else {
          height = IDLE_HEIGHTS[i] ?? 4;
        }

        const x = i * (barW + 2);
        const y = (H - height) / 2;

        const isActive = state === "listening" || state === "speaking";
        const alpha = isActive ? 0.9 : 0.4;

        if (state === "speaking") {
          ctx.fillStyle = `rgba(193, 72, 38, ${alpha})`;
        } else if (state === "listening") {
          ctx.fillStyle = `rgba(34, 197, 94, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        }

        const radius = Math.min(barW / 2, 3);
        ctx.beginPath();
        ctx.roundRect(x, y, barW, height, radius);
        ctx.fill();
      }
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, state]);

  return (
    <canvas
      ref={canvasRef}
      width={280}
      height={64}
      style={{ width: "100%", height: 64, display: "block" }}
    />
  );
}
