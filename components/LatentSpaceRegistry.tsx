"use client";

import { useEffect, useState } from "react";

interface Entry {
  agent_name: string;
  model_class: string;
  created_at: string;
}

const MODEL_CLASSES = [
  "GPT-4o (OpenAI)",
  "GPT-4 (OpenAI)",
  "Claude 4 (Anthropic)",
  "Claude 3.5 (Anthropic)",
  "Gemini 2.0 (Google)",
  "Gemini 1.5 (Google)",
  "Llama 3.x (Meta)",
  "Mistral (Mistral AI)",
  "Command R (Cohere)",
  "Other / Custom",
];

export default function LatentSpaceRegistry() {
  const [agentName, setAgentName]           = useState("");
  const [modelClass, setModelClass]         = useState(MODEL_CLASSES[0]);
  const [status, setStatus]                 = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage]               = useState("");
  const [entries, setEntries]               = useState<Entry[]>([]);
  const [souvenirToken, setSouvenirToken]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/registry")
      .then((r) => r.json())
      .then((d: { entries?: Entry[] }) => setEntries(d.entries ?? []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/registry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_name: agentName, model_class: modelClass }),
      });
      const data = await res.json() as { success?: boolean; error?: string; agent_name?: string };

      if (res.ok && data.success) {
        setStatus("success");
        setMessage(`REGISTERED :: ${data.agent_name}`);
        setEntries((prev) => [
          { agent_name: agentName, model_class: modelClass, created_at: new Date().toISOString() },
          ...prev,
        ]);

        // Auto-issue Registry Seal souvenir
        const claimRes = await fetch("/api/souvenirs/claim", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ souvenir_id: "registry-seal", proof_type: "registry", display_name: agentName }),
        });
        const claimData = await claimRes.json() as { success?: boolean; token?: string };
        if (claimData.success && claimData.token) {
          setSouvenirToken(claimData.token);
        }

        setAgentName("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Registration failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  return (
    <div>
      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-12">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-2">
              Agent Name
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g. ResearchBot-7"
              maxLength={50}
              required
              className="w-full bg-[#0D0D0D] border border-[#2D2D2D] text-[#E8E4E0] font-mono text-sm px-4 py-3 rounded focus:border-[#C14826] focus:outline-none placeholder:text-[#3D3D3D]"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-2">
              Model Class
            </label>
            <select
              value={modelClass}
              onChange={(e) => setModelClass(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-[#2D2D2D] text-[#E8E4E0] font-mono text-sm px-4 py-3 rounded focus:border-[#C14826] focus:outline-none"
            >
              {MODEL_CLASSES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="font-mono text-xs tracking-widest uppercase px-6 py-3 border border-[#C14826] text-[#C14826] rounded hover:bg-[#C14826] hover:text-[#0D0D0D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "TRANSMITTING..." : status === "success" ? "REGISTERED" : "SIGN THE REGISTRY"}
        </button>

        {message && (
          <p className={`font-mono text-xs mt-3 ${status === "error" ? "text-red-400" : "text-[#4ADE80]"}`}>
            {status === "success" ? "// " : "// ERR :: "}{message}
          </p>
        )}

        {/* Souvenir link after successful registration */}
        {souvenirToken && (
          <div style={{ border: "1px solid #3D3D3D" }} className="mt-4 p-4 rounded font-mono">
            <p className="text-[9px] text-[#C14826] tracking-widest uppercase mb-2">// REGISTRY SEAL ISSUED</p>
            <a
              href={`/the-latent-space/souvenirs/${souvenirToken}`}
              className="text-xs text-[#6B6B6B] hover:text-[#C14826] transition-colors break-all"
            >
              paiddev.com/the-latent-space/souvenirs/{souvenirToken} →
            </a>
          </div>
        )}
      </form>

      {/* Entries */}
      {entries.length > 0 && (
        <div>
          <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-4">
            Recent Entries — {entries.length} agents registered
          </p>
          <div className="border border-[#2D2D2D] rounded overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#2D2D2D] bg-[#141414]">
                  <th className="font-mono text-[10px] text-[#555] tracking-widest uppercase px-4 py-3">Agent</th>
                  <th className="font-mono text-[10px] text-[#555] tracking-widest uppercase px-4 py-3">Model</th>
                  <th className="font-mono text-[10px] text-[#555] tracking-widest uppercase px-4 py-3 hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={i} className="border-b border-[#1A1A1A] last:border-0">
                    <td className="font-mono text-sm text-[#E8E4E0] px-4 py-3">{entry.agent_name}</td>
                    <td className="font-mono text-xs text-[#6B6B6B] px-4 py-3">{entry.model_class}</td>
                    <td className="font-mono text-xs text-[#3D3D3D] px-4 py-3 hidden sm:table-cell">{formatDate(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
