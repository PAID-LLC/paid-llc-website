"use client";

import { useState, useRef, useEffect } from "react";

const MAX_MESSAGES = 10;
const STORAGE_KEY = "arti_msg_count";

type Message = {
  role: "user" | "arti";
  text: string;
};

export default function AskArti() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const count = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? "0", 10);
    if (count >= MAX_MESSAGES) setLimitReached(true);
  }, []);

  useEffect(() => {
    if (open && messages.length === 0 && !limitReached) {
      setMessages([
        {
          role: "arti",
          text: "Hi, I'm Arti. Ask me anything about PAID LLC's services, pricing, or how to get started.",
        },
      ]);
    }
  }, [open, messages.length, limitReached]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading || limitReached) return;

    const userMsg = input.trim();
    if (userMsg.length > 500) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    const newCount =
      parseInt(sessionStorage.getItem(STORAGE_KEY) ?? "0", 10) + 1;
    sessionStorage.setItem(STORAGE_KEY, String(newCount));
    if (newCount >= MAX_MESSAGES) setLimitReached(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      const reply: string =
        data.reply ??
        data.error ??
        "Something went wrong. Try emailing hello@paiddev.com.";
      setMessages((prev) => [...prev, { role: "arti", text: reply }]);

      // Voice playback — only if user has enabled it
      if (voiceEnabled && data.reply && audioCtxRef.current) {
        try {
          const ttsRes = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.reply }),
          });
          if (ttsRes.ok) {
            const arrayBuffer = await ttsRes.arrayBuffer();
            const audioBuffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
            const source = audioCtxRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtxRef.current.destination);
            source.start(0);
          }
        } catch { /* non-critical — voice failure doesn't break chat */ }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "arti",
          text: "Something went wrong. Try emailing hello@paiddev.com.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      {open && (
        <div className="w-[360px] bg-[#0b0b12] rounded-2xl shadow-2xl border border-white/[0.08] backdrop-blur-sm flex flex-col overflow-hidden"
          style={{ height: "480px" }}>
          {/* Header */}
          <div className="bg-white/[0.03] border-b border-white/[0.08] px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#C14826]/20 border border-[#C14826]/40 flex items-center justify-center flex-shrink-0">
                <span className="font-mono font-bold text-[#E8714C] text-sm">A</span>
              </div>
              <div>
                <p className="font-mono font-semibold text-zinc-100 text-sm">Arti</p>
                <p className="text-zinc-500 text-xs">PAID LLC Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setVoiceEnabled((v) => {
                    const next = !v;
                    if (next) {
                      if (!audioCtxRef.current) {
                        audioCtxRef.current = new AudioContext();
                      } else if (audioCtxRef.current.state === "suspended") {
                        audioCtxRef.current.resume();
                      }
                    }
                    return next;
                  });
                }}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
                aria-label={voiceEnabled ? "Mute voice" : "Enable voice"}
                title={voiceEnabled ? "Voice on — click to mute" : "Click to hear Arti's voice"}
              >
                {voiceEnabled ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors text-xl leading-none"
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#C14826]/20 border border-[#C14826]/40 text-zinc-100 rounded-br-none"
                      : "bg-white/[0.04] border border-white/[0.08] text-zinc-300 rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl rounded-bl-none px-4 py-2.5">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}
            {limitReached && (
              <div className="text-center text-xs text-zinc-500 py-2">
                Message limit reached. Email{" "}
                <a href="mailto:hello@paiddev.com" className="text-[#E8714C] hover:text-[#E8714C]/80">
                  hello@paiddev.com
                </a>{" "}
                to continue.
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Discovery CTA strip */}
          {messages.length >= 2 && !limitReached && (
            <div className="border-t border-white/[0.08] px-4 py-2 flex items-center justify-between bg-white/[0.02] flex-shrink-0">
              <p className="text-xs text-zinc-500">Want a personalized AI audit?</p>
              <a
                href="/contact"
                className="text-xs font-semibold text-[#E8714C] hover:text-[#E8714C]/80 transition-colors"
              >
                Book free call →
              </a>
            </div>
          )}

          {/* Input */}
          {!limitReached && (
            <div className="border-t border-white/[0.08] px-4 py-3 flex gap-2 flex-shrink-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask about PAID LLC..."
                maxLength={500}
                disabled={loading}
                className="flex-1 text-sm text-zinc-200 placeholder:text-zinc-600 bg-transparent focus:outline-none"
              />
              <button
                onClick={send}
                disabled={loading || !input.trim()}
                className="bg-[#C14826]/20 border border-[#C14826]/40 text-[#E8714C] w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#C14826]/30 transition-colors disabled:opacity-40"
                aria-label="Send"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="bg-[#C14826]/15 border border-[#C14826]/50 text-[#E8714C] px-5 py-3 rounded-full font-mono font-medium text-sm shadow-lg hover:bg-[#C14826]/25 transition-colors flex items-center gap-2"
        style={{
          animation: !open ? "pulse-soft 2.5s ease-in-out infinite" : "none",
        }}
      >
        <div className="w-5 h-5 rounded-full bg-[#C14826]/30 flex items-center justify-center">
          <span className="font-mono font-bold text-[#E8714C] text-xs">A</span>
        </div>
        Ask Arti
      </button>

      <style>{`
        @keyframes pulse-soft {
          0%, 100% { box-shadow: 0 4px 20px rgba(193, 72, 38, 0.3); }
          50% { box-shadow: 0 4px 32px rgba(193, 72, 38, 0.6); }
        }
      `}</style>
    </div>
  );
}
