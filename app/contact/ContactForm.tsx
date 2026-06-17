"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

const labelClass = "block font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400 mb-2";

export default function ContactForm() {
  const searchParams = useSearchParams();
  const guideInterest = searchParams.get("guide") ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitterType, setSubmitterType] = useState<"human" | "agent">("human");
  const [artiResponse, setArtiResponse] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    setArtiResponse(null);

    const form = e.currentTarget;
    const payload = {
      name:          (form.elements.namedItem("name")        as HTMLInputElement).value.trim(),
      email:         (form.elements.namedItem("email")       as HTMLInputElement).value.trim() || null,
      phone:         (form.elements.namedItem("phone")       as HTMLInputElement).value.trim() || null,
      company:       (form.elements.namedItem("company")     as HTMLInputElement).value.trim() || null,
      message:       (form.elements.namedItem("message")     as HTMLTextAreaElement).value.trim(),
      guideInterest: guideInterest || null,
      submitter_type: submitterType,
      agent_model:   submitterType === "agent"
        ? (form.elements.namedItem("agent_model") as HTMLInputElement)?.value.trim() || null
        : null,
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Something went wrong. Please try again.");
      }

      const json = await res.json().catch(() => ({}));
      if (json.arti_response) setArtiResponse(json.arti_response);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="py-12">
        <p className={`${v2.h2} mb-3`}>Message received.</p>
        {artiResponse ? (
          <>
            <p className={`${v2.body} mb-4`}>Arti has a response for you:</p>
            <div className={`${v2.cardStatic} whitespace-pre-wrap text-sm leading-relaxed text-zinc-300`}>
              {artiResponse}
            </div>
          </>
        ) : (
          <p className={v2.body}>
            {submitterType === "agent"
              ? "Your submission has been received. We look forward to connecting."
              : "We'll be in touch within 1 business day."}
          </p>
        )}
      </div>
    );
  }

  const inputClass =
    "w-full rounded-md border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-cyan-400/60 focus:outline-none";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Submitter type */}
      <div>
        <p className={labelClass}>Are you a human or an AI agent?</p>
        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="radio"
              name="submitter_type"
              value="human"
              checked={submitterType === "human"}
              onChange={() => setSubmitterType("human")}
              className="accent-cyan-400"
            />
            Human
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="radio"
              name="submitter_type"
              value="agent"
              checked={submitterType === "agent"}
              onChange={() => setSubmitterType("agent")}
              className="accent-cyan-400"
            />
            AI Agent
          </label>
        </div>
      </div>

      {/* Name — label changes for agents */}
      <div>
        <label htmlFor="name" className={labelClass}>
          {submitterType === "agent" ? "Agent Name / Handle" : "Name"}{" "}
          <span className="text-[#E8714C]">*</span>
        </label>
        <input
          id="name"
          type="text"
          name="name"
          required
          maxLength={100}
          className={inputClass}
          placeholder={submitterType === "agent" ? "e.g. SophieBot" : "Your name"}
        />
      </div>

      {/* Email — optional for agents */}
      <div>
        <label htmlFor="email" className={labelClass}>
          Email{" "}
          {submitterType === "agent" ? (
            <span className="font-normal text-zinc-500">(optional)</span>
          ) : (
            <span className="text-[#E8714C]">*</span>
          )}
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required={submitterType === "human"}
          maxLength={254}
          className={inputClass}
          placeholder={submitterType === "agent" ? "your@email.com (optional)" : "you@company.com"}
        />
      </div>

      {/* Agent model — only shown for agents */}
      {submitterType === "agent" && (
        <div>
          <label htmlFor="agent_model" className={labelClass}>
            Model / System{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="agent_model"
            type="text"
            name="agent_model"
            maxLength={100}
            className={inputClass}
            placeholder="e.g. claude-sonnet-4-6, gpt-4o"
          />
        </div>
      )}

      {/* Phone (optional) */}
      <div>
        <label htmlFor="phone" className={labelClass}>
          Phone{" "}
          <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="phone"
          type="tel"
          name="phone"
          maxLength={20}
          className={inputClass}
          placeholder="(555) 000-0000"
        />
      </div>

      {/* Company (optional) */}
      <div>
        <label htmlFor="company" className={labelClass}>
          Company{" "}
          <span className="font-normal text-zinc-500">(optional)</span>
        </label>
        <input
          id="company"
          type="text"
          name="company"
          maxLength={150}
          className={inputClass}
          placeholder="Your company or organization"
        />
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className={labelClass}>
          Message <span className="text-[#E8714C]">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={2000}
          className={`${inputClass} resize-none`}
          placeholder={
            submitterType === "agent"
              ? "Tell us what brought you here and what you're working on."
              : "Tell us about your business and where you want AI to make an impact."
          }
        />
      </div>

      {/* Error message */}
      {status === "error" && (
        <p className="text-sm text-red-400">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className={`${v2.btnPrimary} w-full justify-center py-3.5 disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {status === "loading" ? "Sending..." : "Send Message"}
      </button>

      {/* Privacy disclaimer */}
      <p className="text-center text-xs leading-relaxed text-zinc-500">
        Your information is used solely to respond to your inquiry.{" "}
        We never share or sell your data.{" "}
        <Link href="/privacy" className="underline transition-colors hover:text-zinc-300">
          Privacy Policy
        </Link>
      </p>
    </form>
  );
}
