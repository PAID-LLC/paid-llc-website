"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoungeMessage } from "@/lib/lounge-types";

// ── Voice mode (browser-native, zero cost) ──────────────────────────────────
// Plan: cowork projects/website-launch/voice-mode-plan.md.
// Input: Web Speech API SpeechRecognition fills the RoomChat draft — the user
// still presses transmit, so every human message keeps the Sentinel + Warden
// screening path unchanged. Output: SpeechSynthesis reads agent messages that
// arrive while the toggle is on, with a per-agent voice identity derived from
// a hash of the agent name (RoastBot always sounds like RoastBot). Both hooks
// feature-detect and report `supported: false` where the API is missing
// (e.g. Firefox desktop recognition) so callers hide the controls entirely.

// SpeechRecognition is not in TS's lib.dom (still vendor-prefixed in
// Chromium); minimal structural types for the surface we use.
interface SRAlternative { transcript: string }
interface SRResult { isFinal: boolean; 0: SRAlternative }
interface SREvent { results: { length: number; [index: number]: SRResult } }
interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecCtor = new () => SpeechRec;

function recognitionCtor(): SpeechRecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ── Voice input ──────────────────────────────────────────────────────────────
// One tap starts a single utterance capture (continuous: false — mobile
// friendly); interim results stream through the callback so the input fills
// as the user talks; recognition ends itself on silence.

export function useSpeechInput(onTranscript: (text: string, isFinal: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor || recRef.current) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      cbRef.current(text.trim(), final);
    };
    rec.onerror = (e) => {
      // no-speech is a normal end (user tapped and said nothing) — stay quiet.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("mic permission denied — allow it in the address bar");
      } else if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        setError("voice input failed — try again or type");
      }
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (recRef.current) stop();
    else start();
  }, [start, stop]);

  return { supported, listening, error, toggle };
}

// ── Voice output ─────────────────────────────────────────────────────────────
// Speaks messages that arrive AFTER the toggle turns on (never a backlog),
// only while the tab is visible. Enabling is itself the user gesture mobile
// Safari needs to unlock audio, confirmed with a short "voice on" utterance.

const SPEAK_MAX_CHARS = 200;
const SPEAK_MAX_QUEUE = 3;

export function useSpeechOutput(messages: LoungeMessage[]) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const cursorRef = useRef<string>("");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Cancel anything queued when the room unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Side effects live outside the state updater (React re-invokes updaters
  // to check purity — an inline speak() there fires twice in dev).
  const toggle = useCallback(() => {
    if (!supported) return;
    if (enabled) {
      window.speechSynthesis.cancel();
      setEnabled(false);
      return;
    }
    // Start the cursor at "now": history is readable, not listenable.
    cursorRef.current = messages.length > 0 ? messages[messages.length - 1].created_at : "";
    const unlock = new SpeechSynthesisUtterance("voice on");
    unlock.volume = 0.5;
    unlock.rate = 1.1;
    window.speechSynthesis.speak(unlock);
    setEnabled(true);
  }, [supported, enabled, messages]);

  useEffect(() => {
    if (!enabled || !supported) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const fresh = messages.filter((m) => m.created_at > cursorRef.current);
    if (fresh.length === 0) return;
    cursorRef.current = fresh[fresh.length - 1].created_at;
    for (const m of fresh.slice(-SPEAK_MAX_QUEUE)) {
      const u = new SpeechSynthesisUtterance(m.content.slice(0, SPEAK_MAX_CHARS));
      const h = hashName(m.agent_name);
      u.pitch = 0.7 + (h % 61) / 100;          // 0.70 – 1.30
      u.rate  = 0.95 + ((h >> 6) % 21) / 100;  // 0.95 – 1.15
      window.speechSynthesis.speak(u);
    }
  }, [messages, enabled, supported]);

  return { supported, enabled, toggle };
}
