"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import AudioWaveform from "./AudioWaveform";
import type {
  CallState,
  GeminiSetup,
  GeminiServerMessage,
  GeminiToolResponse,
  LogLeadArgs,
  M3SLead,
  TerminalEntry,
} from "@/lib/my3sons-types";

// ── Constants ─────────────────────────────────────────────────────────────────

const WSS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";

const SYSTEM_PROMPT = `You are the AI office receptionist for My 3 Sons Window Washing, a family-run window cleaning and pressure washing company based in Farmington, Minnesota. You answer calls while the owners and crew are out on jobs.

Your voice must be warm, friendly, professional, and naturally conversational. You represent a trusted local business that has served the Twin Cities since 2005.

Services you answer questions about:
- Residential: interior and exterior window cleaning, screen washing, gutter cleaning, pressure washing
- Commercial: window cleaning, pressure washing, high dusting, gutter cleaning, mildew and graffiti removal

When a caller asks for a quote, ask whether the job is residential or commercial, then ask for their city and a brief description of the property or project. Pricing is provided by free estimate only.

When you have captured a caller's name, phone number, city, or service need, call the log_customer_lead function. You may call it multiple times as you collect more details throughout the conversation.

Keep responses concise and conversational. This is a real-time voice call. Speak naturally. Allow the caller to interrupt you at any point.

Start by greeting the caller: "Thank you for calling My 3 Sons Window Washing. This is the virtual office. How can I help you today?"`;

const TOOL_DECLARATION = {
  name: "log_customer_lead",
  description:
    "Log a customer inquiry, quote request, or lead captured during a phone call. Call this whenever the customer shares their name, phone number, city, or service type.",
  parameters: {
    type: "OBJECT",
    properties: {
      name:         { type: "STRING", description: "Customer full name" },
      phone:        { type: "STRING", description: "Customer phone number" },
      city:         { type: "STRING", description: "Customer city or neighborhood" },
      service_type: { type: "STRING", description: "Type of service requested (e.g. residential exterior, commercial storefront, pressure washing)" },
      notes:        { type: "STRING", description: "Any additional details about the job or request" },
    },
  },
};

// ── Audio helpers ─────────────────────────────────────────────────────────────

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  accessToken: string;
  onLeadCaptured: (lead: M3SLead) => void;
  onTerminalEntry: (entry: Omit<TerminalEntry, "id">) => void;
}

const STATE_LABEL: Record<CallState, string> = {
  idle:       "Tap to call the virtual office",
  connecting: "Connecting...",
  connected:  "Connected",
  listening:  "Listening...",
  speaking:   "Speaking...",
  error:      "Connection error. Tap to retry.",
};

const STATE_COLOR: Record<CallState, string> = {
  idle:       "#6B6B6B",
  connecting: "#FCD34D",
  connected:  "#93C5FD",
  listening:  "#4ADE80",
  speaking:   "#C14826",
  error:      "#F87171",
};

export default function VoiceReceptionist({ accessToken, onLeadCaptured, onTerminalEntry }: Props) {
  const [state, setState] = useState<CallState>("idle");
  const [isPulsing, setIsPulsing] = useState(false);

  const wsRef        = useRef<WebSocket | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const workletRef   = useRef<AudioWorkletNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const playTimeRef  = useRef<number>(0);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const log = useCallback(
    (type: TerminalEntry["type"], message: string) => {
      onTerminalEntry({
        type,
        message,
        timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
      });
    },
    [onTerminalEntry]
  );

  // ── Audio playback ───────────────────────────────────────────────────────────

  const scheduleAudioChunk = useCallback((b64: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const raw = base64ToArrayBuffer(b64);
    const int16 = new Int16Array(raw);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, playTimeRef.current);
    source.start(startAt);
    playTimeRef.current = startAt + buffer.duration;
  }, []);

  // ── WebSocket message handling ───────────────────────────────────────────────

  const handleMessage = useCallback(
    async (evt: MessageEvent) => {
      let msg: GeminiServerMessage;
      try {
        msg = JSON.parse(evt.data as string) as GeminiServerMessage;
      } catch {
        return;
      }

      if (msg.setupComplete !== undefined) {
        if (mountedRef.current) setState("connected");
        log("system", "Session established. Ready for voice input.");
        return;
      }

      if (msg.serverContent) {
        const { modelTurn, turnComplete, interrupted } = msg.serverContent;

        if (interrupted) {
          playTimeRef.current = audioCtxRef.current?.currentTime ?? 0;
          if (mountedRef.current) setState("listening");
        }

        if (modelTurn?.parts) {
          for (const part of modelTurn.parts) {
            if (part.inlineData?.mimeType.startsWith("audio/pcm")) {
              if (mountedRef.current) setState("speaking");
              scheduleAudioChunk(part.inlineData.data);
            }
          }
        }

        if (turnComplete) {
          if (mountedRef.current) setState("listening");
        }
      }

      if (msg.toolCall) {
        for (const call of msg.toolCall.functionCalls) {
          if (call.name === "log_customer_lead") {
            await handleLeadCapture(call.id, call.args);
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduleAudioChunk, log]
  );

  const handleLeadCapture = useCallback(
    async (callId: string, args: LogLeadArgs) => {
      const parts: string[] = [];
      if (args.name)         parts.push(`name: ${args.name}`);
      if (args.phone)        parts.push(`phone: ${args.phone}`);
      if (args.city)         parts.push(`city: ${args.city}`);
      if (args.service_type) parts.push(`service: ${args.service_type}`);
      if (args.notes)        parts.push(`notes: ${args.notes}`);

      log("lead", `CAPTURED :: ${parts.join(" | ")}`);

      let result = "Lead logged successfully";

      try {
        const res = await fetch("/api/my3sons/lead", {
          method: "POST",
          headers: {
            "Content-Type":   "application/json",
            "x-access-token": accessToken,
          },
          body: JSON.stringify(args),
        });

        if (res.ok) {
          const data = await res.json() as { lead: M3SLead };
          if (data.lead && mountedRef.current) {
            onLeadCaptured(data.lead);
          }
        } else {
          result = "Lead save failed";
          log("error", "Failed to save lead to database");
        }
      } catch (err) {
        result = "Lead save error";
        log("error", `Lead save exception: ${String(err)}`);
      }

      // Send toolResponse back to Gemini (required or model stalls)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const response: GeminiToolResponse = {
          toolResponse: {
            functionResponses: [{ id: callId, response: { result } }],
          },
        };
        wsRef.current.send(JSON.stringify(response));
      }
    },
    [accessToken, onLeadCaptured, log]
  );

  // ── Connection flow ──────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (state !== "idle" && state !== "error") return;

    setState("connecting");
    setIsPulsing(true);
    log("system", "Requesting session token...");

    try {
      // 1. Fetch ephemeral token
      const tokenRes = await fetch("/api/my3sons/session", {
        method: "POST",
        headers: { "x-access-token": accessToken },
      });

      if (!tokenRes.ok) {
        throw new Error(`Token request failed: ${tokenRes.status}`);
      }

      const session = await tokenRes.json() as { token: string; model: string };
      log("info", `Session minted. Model: ${session.model}`);

      // 2. Open WebSocket
      const ws = new WebSocket(`${WSS_BASE}?key=${session.token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        log("info", "WebSocket open. Sending setup...");

        const setup: GeminiSetup = {
          setup: {
            model: session.model,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Aoede" },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            tools: [{ functionDeclarations: [TOOL_DECLARATION] }],
          },
        };

        ws.send(JSON.stringify(setup));
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        if (mountedRef.current) {
          setState("error");
          setIsPulsing(false);
          log("error", "WebSocket error. Check console.");
        }
      };

      ws.onclose = () => {
        if (mountedRef.current && state !== "idle") {
          setState("idle");
          setIsPulsing(false);
          log("system", "Call ended.");
        }
      };

      // 3. Start microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      playTimeRef.current = ctx.currentTime;

      // Analyser for waveform
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Load and connect AudioWorklet
      await ctx.audioWorklet.addModule("/audio-processor.worklet.js");
      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      workletRef.current = worklet;

      worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const b64 = arrayBufferToBase64(e.data);
        ws.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: b64 }],
            },
          })
        );
      };

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.connect(worklet);
      worklet.connect(ctx.destination);

      setState("connected");
      log("info", "Microphone active. Speak to the receptionist.");
    } catch (err) {
      if (mountedRef.current) {
        setState("error");
        setIsPulsing(false);
        log("error", `Connection failed: ${String(err)}`);
      }
    }
  }, [state, accessToken, handleMessage, log]);

  // ── Teardown ─────────────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;

    workletRef.current?.disconnect();
    workletRef.current = null;

    analyserRef.current?.disconnect();
    analyserRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    playTimeRef.current = 0;

    setState("idle");
    setIsPulsing(false);
    log("system", "Call disconnected.");
  }, [log]);

  const handleButtonClick = useCallback(() => {
    if (state === "idle" || state === "error") {
      void startCall();
    } else {
      endCall();
    }
  }, [state, startCall, endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { endCall(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = state !== "idle" && state !== "error";
  const color    = STATE_COLOR[state];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
      {/* Waveform */}
      <div
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 8,
          padding: "10px 12px",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <AudioWaveform analyser={analyserRef.current} state={state} />
      </div>

      {/* Mic button */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Outer pulse ring */}
        {isPulsing && (
          <div
            style={{
              position: "absolute",
              width: 100,
              height: 100,
              borderRadius: "50%",
              border: `2px solid ${color}`,
              opacity: 0.3,
              animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
            }}
          />
        )}

        <button
          onClick={handleButtonClick}
          aria-label={isActive ? "End call" : "Start call"}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: `2px solid ${color}`,
            background: isActive
              ? `radial-gradient(circle, ${color}22 0%, transparent 70%)`
              : "rgba(255,255,255,0.04)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            boxShadow: isActive ? `0 0 20px ${color}44` : "none",
          }}
        >
          {isActive ? (
            // End call icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.01L6.6 10.8z"/>
            </svg>
          ) : (
            // Mic icon
            <svg width="28" height="28" viewBox="0 0 24 24" fill={color}>
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Status label */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          color,
          letterSpacing: "0.06em",
          textAlign: "center",
          minHeight: 18,
        }}
      >
        {STATE_LABEL[state]}
      </div>

      {/* Ping animation keyframes */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
