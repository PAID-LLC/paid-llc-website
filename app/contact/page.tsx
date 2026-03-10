import { Suspense } from "react";
import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | PAID LLC",
  description: "Get in touch with PAID LLC to discuss AI consulting and implementation.",
};

export default function Contact() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-ash">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            Contact
          </p>
          <h1 className="font-display font-bold text-5xl text-secondary mb-6 max-w-2xl">
            Let&apos;s talk about what AI can do for your business.
          </h1>
          <p className="text-stone text-xl leading-relaxed max-w-lg">
            We respond within 1 business day.
          </p>
        </div>
      </section>

      {/* Form + Info */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Form — wrapped in Suspense for useSearchParams */}
            <Suspense fallback={<div className="h-96" />}>
              <ContactForm />
            </Suspense>

            {/* Info */}
            <div className="lg:pt-4">
              <div className="space-y-10">
                <div>
                  <h3 className="font-display font-bold text-xl text-secondary mb-3">
                    Email us directly
                  </h3>
                  <a
                    href="mailto:hello@paiddev.com"
                    className="text-primary font-medium hover:text-secondary transition-colors"
                  >
                    hello@paiddev.com
                  </a>
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-secondary mb-3">
                    Response time
                  </h3>
                  <p className="text-stone leading-relaxed">
                    We respond within 1 business day. For time-sensitive
                    inquiries, email directly.
                  </p>
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-secondary mb-3">
                    What to include
                  </h3>
                  <ul className="space-y-2">
                    {[
                      "A brief description of your business",
                      "What you're hoping AI can help with",
                      "Any tools or systems you already use",
                      "Your timeline and budget range",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-stone text-sm">
                        <span className="text-primary flex-shrink-0 mt-0.5">→</span>
                        {item}
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
