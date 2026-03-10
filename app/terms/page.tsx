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
            Disclaimer
          </h2>
          <p>
            This site and its content are provided &quot;as is&quot; without warranty of
            any kind. PAID LLC is not liable for any damages arising from use
            of this site.
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
          <p className="text-stone text-sm italic mt-12">
            This is a placeholder. Replace with complete terms generated via a
            legal document generator before launch.
          </p>
        </div>
      </div>
    </section>
  );
}
