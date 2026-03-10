"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ContactForm() {
  const searchParams = useSearchParams();
  const guideInterest = searchParams.get("guide") ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const payload = {
      name:          (form.elements.namedItem("name")    as HTMLInputElement).value.trim(),
      email:         (form.elements.namedItem("email")   as HTMLInputElement).value.trim(),
      phone:         (form.elements.namedItem("phone")   as HTMLInputElement).value.trim() || null,
      company:       (form.elements.namedItem("company") as HTMLInputElement).value.trim() || null,
      message:       (form.elements.namedItem("message") as HTMLTextAreaElement).value.trim(),
      guideInterest: guideInterest || null,
      website: (form.elements.namedItem("website") as HTMLInputElement)?.value || "",
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
        <p className="text-stone">We&apos;ll be in touch within 1 business day.</p>
      </div>
    );
  }

  const inputClass =
    "w-full border border-ash rounded px-4 py-3 text-secondary placeholder:text-stone focus:outline-none focus:border-secondary transition-colors text-sm";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Honeypot — hidden from real users, catches bots that fill all fields */}
      <div aria-hidden="true" style={{ display: "none" }}>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Name */}
      <div>
        <label htmlFor="name" className="block font-display font-semibold text-secondary text-sm mb-2">
          Name <span className="text-primary">*</span>
        </label>
        <input
          id="name"
          type="text"
          name="name"
          required
          maxLength={100}
          className={inputClass}
          placeholder="Your name"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block font-display font-semibold text-secondary text-sm mb-2">
          Email <span className="text-primary">*</span>
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          maxLength={254}
          className={inputClass}
          placeholder="you@company.com"
        />
      </div>

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
          placeholder="Your company"
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
          placeholder="Tell us about your business and where you want AI to make an impact."
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
