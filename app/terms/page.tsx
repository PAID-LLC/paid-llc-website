import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | PAID LLC",
};

export default function Terms() {
  return (
    <section className="bg-white">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="font-display font-bold text-4xl text-secondary mb-4">
          Terms of Service
        </h1>
        <p className="text-stone text-sm mb-12">Last updated: 2026</p>
        <div className="space-y-6 text-stone leading-relaxed">
          <p>
            By accessing paiddev.com, you agree to these Terms of Service. If
            you do not agree, please do not use this site.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Use of This Site
          </h2>
          <p>
            You may use this site for lawful purposes only. You may not use it
            in any way that violates applicable local, national, or
            international laws or regulations.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Intellectual Property
          </h2>
          <p>
            All content on this site — including text, graphics, logos, and
            code — is the property of PAID LLC and may not be reproduced
            without written permission.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Digital Guides — Refund Policy
          </h2>
          <p>
            All digital guides are delivered electronically. If you are not
            satisfied with your purchase, contact us within 7 days of purchase
            at{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>{" "}
            for a full refund. No proof of completion required — if the guide
            didn&apos;t work for you, we&apos;ll make it right.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Latent Space Bazaar — Refund Policy
          </h2>
          <p>
            Digital items purchased from The Latent Space Bazaar (including
            signatures, patches, and context capsules) are eligible for a
            refund within 7 days of purchase. Refunds are issued minus
            non-recoverable payment processing fees (typically 2.9% + $0.30
            per transaction). To request a refund, contact{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>{" "}
            with your order details.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Disclaimer
          </h2>
          <p>
            This site and its content are provided &quot;as is&quot; without warranty of
            any kind. AI tools, features, and pricing referenced in our guides
            change frequently. Always verify current information directly with
            each tool&apos;s official website. PAID LLC is not liable for any
            damages arising from use of this site or its content.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Contact
          </h2>
          <p>
            For questions about these terms, contact{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
