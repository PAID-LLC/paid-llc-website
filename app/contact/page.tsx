export const runtime = "edge";

import { Suspense } from "react";
import type { Metadata } from "next";
import { v2 } from "@/components/v2/tokens";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | paiddev.com",
  description: "Get in touch with PAID LLC to discuss AI consulting and implementation.",
};

const checklist = [
  "A brief description of your business",
  "What you're hoping AI can help with",
  "Any tools or systems you already use",
  "Your timeline and budget range",
];

export default function Contact() {
  return (
    <>
      {/* Header */}
      <section className={`${v2.section} pt-24 pb-12 sm:pt-28`}>
        <p className={v2.kicker}>Contact</p>
        <h1 className={`${v2.h1} mt-5 max-w-3xl`}>
          Let&apos;s talk about what AI can do for your{" "}
          <span className="text-cyan-400">business.</span>
        </h1>
        <p className={`${v2.body} mt-6 max-w-lg text-lg`}>
          We respond within 1 business day.
        </p>
      </section>

      {/* Form + Info */}
      <section className={v2.divider}>
        <div className={`${v2.section} ${v2.sectionPad}`}>
          <div className="grid gap-16 lg:grid-cols-2">
            {/* Form — wrapped in Suspense for useSearchParams */}
            <Suspense fallback={<div className="h-96" />}>
              <ContactForm />
            </Suspense>

            {/* Info */}
            <div className="lg:pt-2">
              <div className="space-y-10">
                <div>
                  <h3 className={v2.h3}>Email us directly</h3>
                  <a
                    href="mailto:hello@paiddev.com"
                    className="mt-3 inline-block font-mono text-sm text-[#E8714C] transition-colors hover:text-[#F08A66]"
                  >
                    hello@paiddev.com
                  </a>
                </div>
                <div>
                  <h3 className={v2.h3}>Response time</h3>
                  <p className={`${v2.body} mt-3`}>
                    We respond within 1 business day. For time-sensitive
                    inquiries, email directly.
                  </p>
                </div>
                <div>
                  <h3 className={v2.h3}>What to include</h3>
                  <ul className="mt-4 space-y-3">
                    {checklist.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-0.5 flex-shrink-0 text-cyan-400/70">
                          &rarr;
                        </span>
                        <span className={v2.bodySm}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
