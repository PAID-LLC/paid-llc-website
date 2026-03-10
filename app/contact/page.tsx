import type { Metadata } from "next";

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
            {/* Form */}
            <div>
              {/*
                SETUP REQUIRED: Replace YOUR_FORM_ID below with your Formspree form ID.
                1. Go to formspree.io and create a free account
                2. Create a new form — name it "PAID LLC Contact"
                3. Copy the form ID (e.g., "xbljkpqz") and paste it below
                Action URL format: https://formspree.io/f/YOUR_FORM_ID
              */}
              <form
                action="https://formspree.io/f/YOUR_FORM_ID"
                method="POST"
                className="space-y-6"
              >
                <div>
                  <label
                    htmlFor="name"
                    className="block font-display font-semibold text-secondary text-sm mb-2"
                  >
                    Name <span className="text-primary">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    required
                    className="w-full border border-ash rounded px-4 py-3 text-secondary placeholder:text-stone focus:outline-none focus:border-secondary transition-colors text-sm"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className="block font-display font-semibold text-secondary text-sm mb-2"
                  >
                    Email <span className="text-primary">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    required
                    className="w-full border border-ash rounded px-4 py-3 text-secondary placeholder:text-stone focus:outline-none focus:border-secondary transition-colors text-sm"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label
                    htmlFor="company"
                    className="block font-display font-semibold text-secondary text-sm mb-2"
                  >
                    Company{" "}
                    <span className="text-stone font-normal">(optional)</span>
                  </label>
                  <input
                    id="company"
                    type="text"
                    name="company"
                    className="w-full border border-ash rounded px-4 py-3 text-secondary placeholder:text-stone focus:outline-none focus:border-secondary transition-colors text-sm"
                    placeholder="Your company"
                  />
                </div>
                <div>
                  <label
                    htmlFor="message"
                    className="block font-display font-semibold text-secondary text-sm mb-2"
                  >
                    Message <span className="text-primary">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    className="w-full border border-ash rounded px-4 py-3 text-secondary placeholder:text-stone focus:outline-none focus:border-secondary transition-colors text-sm resize-none"
                    placeholder="Tell us about your business and where you want AI to make an impact."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary text-white py-4 rounded font-semibold text-sm hover:bg-secondary transition-colors"
                >
                  Send Message
                </button>
              </form>
            </div>

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
