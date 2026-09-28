"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  extractSpeechChunks,
  estimateListenMinutes,
  pickVoice,
  type SpeechChunk,
} from "@/lib/listen";

interface ListenButtonProps {
  title: string;
  // Selector for the rendered article body to read aloud.
  target?: string;
}

type Status = "idle" | "playing" | "paused";

const RATES = [1, 1.25, 1.5, 2, 0.75];
const ACTIVE_CLASS = "listen-active";

export default function ListenButton({
  title,
  target = ".mdx-content",
}: ListenButtonProps) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [rate, setRate] = useState(1);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [position, setPosition] = useState(0);

  const chunks = useRef<SpeechChunk[]>([]);
  const index = useRef(0);
  const rateRef = useRef(1);
  const voice = useRef<SpeechSynthesisVoice | null>(null);
  // Bumped on every stop/restart so late onend events from a cancelled
  // utterance can't advance playback.
  const token = useRef(0);

  const clearHighlight = () => {
    document
      .querySelectorAll(`.${ACTIVE_CLASS}`)
      .forEach((el) => el.classList.remove(ACTIVE_CLASS));
  };

  const loadChunks = useCallback(() => {
    const root = document.querySelector(target);
    chunks.current = root ? extractSpeechChunks(root, title) : [];
    return chunks.current;
  }, [target, title]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    setMinutes(estimateListenMinutes(loadChunks()));

    const synth = window.speechSynthesis;
    const setVoice = () => {
      voice.current = pickVoice(synth.getVoices());
    };
    setVoice();
    synth.addEventListener("voiceschanged", setVoice);

    const stopOnLeave = () => {
      token.current++;
      synth.cancel();
    };
    window.addEventListener("pagehide", stopOnLeave);
    return () => {
      synth.removeEventListener("voiceschanged", setVoice);
      window.removeEventListener("pagehide", stopOnLeave);
      stopOnLeave();
      clearHighlight();
    };
  }, [loadChunks]);

  const speakFrom = useCallback((start: number) => {
    const synth = window.speechSynthesis;
    const run = ++token.current;
    synth.cancel();

    const speakAt = (i: number) => {
      if (run !== token.current) return;
      const chunk = chunks.current[i];
      clearHighlight();
      if (!chunk) {
        index.current = 0;
        setPosition(0);
        setStatus("idle");
        return;
      }
      index.current = i;
      setPosition(i);

      if (chunk.el) {
        chunk.el.classList.add(ACTIVE_CLASS);
        const r = chunk.el.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight - 120) {
          chunk.el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }

      const u = new SpeechSynthesisUtterance(chunk.text);
      u.rate = rateRef.current;
      u.lang = "en-US";
      if (voice.current) u.voice = voice.current;
      u.onend = () => speakAt(i + 1);
      u.onerror = (e) => {
        // "interrupted"/"canceled" come from our own cancel() calls.
        if (e.error === "interrupted" || e.error === "canceled") return;
        speakAt(i + 1);
      };
      synth.speak(u);
    };

    setStatus("playing");
    // Chrome can drop a speak() issued in the same tick as cancel().
    setTimeout(() => speakAt(start), 0);
  }, []);

  const play = () => {
    if (status === "idle") {
      if (loadChunks().length === 0) return;
      speakFrom(0);
    } else {
      speakFrom(index.current);
    }
  };

  // Pause is cancel-and-remember rather than speechSynthesis.pause(), which
  // is unreliable on Android and some desktop voices.
  const pause = () => {
    token.current++;
    window.speechSynthesis.cancel();
    setStatus("paused");
  };

  const stop = () => {
    token.current++;
    window.speechSynthesis.cancel();
    clearHighlight();
    index.current = 0;
    setPosition(0);
    setStatus("idle");
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    rateRef.current = next;
    setRate(next);
    if (status === "playing") speakFrom(index.current);
  };

  if (!supported) return null;

  const total = chunks.current.length;
  const pct = total > 0 ? Math.round((position / total) * 100) : 0;
  const btn =
    "border border-ash rounded px-3 py-2 text-stone text-xs hover:border-primary hover:text-primary transition-colors";

  const controls = (
    <>
      <button
        onClick={status === "playing" ? pause : play}
        className={btn}
        aria-label={status === "playing" ? "Pause reading" : "Resume reading"}
      >
        {status === "playing" ? "Pause" : "Resume"}
      </button>
      <button onClick={cycleRate} className={btn} aria-label="Change reading speed">
        {rate}x
      </button>
      <button onClick={stop} className={btn} aria-label="Stop reading">
        Stop
      </button>
    </>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-stone text-xs uppercase tracking-widest">
          Listen
        </span>
        {status === "idle" ? (
          <button
            onClick={play}
            className={btn}
            aria-label="Listen to this article"
          >
            ▶ Play article{minutes ? ` · ${minutes} min` : ""}
          </button>
        ) : (
          controls
        )}
      </div>

      {status !== "idle" && (
        <div
          className="listen-dock fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#18181b]/95 backdrop-blur border border-white/10 rounded-full shadow-lg px-4 py-2 flex items-center gap-3"
          role="region"
          aria-label="Article audio player"
        >
          <span className="text-stone text-xs font-mono w-10 text-right" aria-live="off">
            {pct}%
          </span>
          {controls}
        </div>
      )}
    </>
  );
}
