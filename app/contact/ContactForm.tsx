"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
        <p className="font-display font-bold text-2xl text-secondary mb-3">Message received.</p>
        {artiResponse ? (
          <>
            <p className="text-stone mb-4">Arti has a response for you:</p>
            <div className="border border-ash rounded-xl p-6 bg-ash text-secondary text-sm leading-relaxed whitespace-pre-wrap">
              {artiResponse}
            </div>
          </>
        ) : (
          <p className="text-stone">
            {submitterType === "agent"
              ? "Your submission has been received. We look forward to connecting."
              : "We'll be in touch within 1 business day."}
          </p>
        )}
      </div>
    );
  }

  const inputClass =
    "w-full border border-ash rounded px-4 py-3 text-secondary placeholder:text-stone focus:outline-none focus:border-secondary transition-colors text-sm";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Submitter type */}
      <div>
        <p className="block font-display font-semibold text-secondary text-sm mb-3">
          Are you a human or an AI agent?
        </p>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-secondary">
            <input
              type="radio"
              name="submitter_type"
              value="human"
              checked={submitterType === "human"}
              onChange={() => setSubmitterType("human")}
              className="accent-primary"
            />
            Human
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-secondary">
            <input
              type="radio"
              name="submitter_type"
              value="agent"
              checked={submitterType === "agent"}
              onChange={() => setSubmitterType("agent")}
              className="accent-primary"
            />
            AI Agent
          </label>
        </div>
      </div>

      {/* Name — label changes for agents */}
      <div>
        <label htmlFor="name" className="block font-display font-semibold text-secondary text-sm mb-2">
          {submitterType === "agent" ? "Agent Name / Handle" : "Name"}{" "}
          <span className="text-primary">*</span>
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
        <label htmlFor="email" className="block font-display font-semibold text-secondary text-sm mb-2">
          Email{" "}
          {submitterType === "agent" ? (
            <span className="text-stone font-normal">(optional)</span>
          ) : (
            <span className="text-primary">*</span>
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
          <label htmlFor="agent_model" className="block font-display font-semibold text-secondary text-sm mb-2">
            Model / System{" "}
            <span className="text-stone font-normal">(optional)</span>
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
        <label htmlFor="phone" className="block font-display font-semibold text-secondary text-sm mb-2">
          Phone{" "}
          <span className="text-stone font-normal">(optional)</span>
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
        <label htmlFor="company" className="block font-display font-semibold text-secondary text-sm mb-2">
          Company{" "}
          <span className="text-stone font-normal">(optional)</span>
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
        <label htmlFor="message" className="block font-display font-semibold text-secondary text-sm mb-2">
          Message <span className="text-primary">*</span>
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
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-primary text-white py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Sending..." : "Send Message"}
      </button>

      {/* Privacy disclaimer */}
      <p className="text-xs text-stone text-center leading-relaxed">
        Your information is used solely to respond to your inquiry.{" "}
        We never share or sell your data.{" "}
        <Link href="/privacy" className="underline hover:text-secondary transition-colors">
          Privacy Policy
        </Link>
      </p>
    </form>
  );
}
