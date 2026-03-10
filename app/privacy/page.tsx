import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | PAID LLC",
};

export default function Privacy() {
  return (
    <section className="bg-white">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <h1 className="font-display font-bold text-4xl text-secondary mb-4">
          Privacy Policy
        </h1>
        <p className="text-stone text-sm mb-12">Last updated: 2026</p>
        <div className="prose prose-stone max-w-none space-y-6 text-stone leading-relaxed">
          <p>
            This Privacy Policy describes how PAID LLC (&quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) collects, uses, and shares information when you visit
            paiddev.com.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Information We Collect
          </h2>
          <p>
            We collect information you provide directly — such as your name,
            email address, and message when you submit our contact form. We
            also collect standard web analytics data through Google Analytics 4,
            including pages visited, time on site, and device type.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            How We Use Information
          </h2>
          <p>
            We use your information to respond to your inquiries, improve our
            services, and understand how visitors use our website. We do not
            sell or share your personal information with third parties for
            marketing purposes.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Contact
          </h2>
          <p>
            For questions about this policy, contact us at{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>
            .
          </p>
          <p className="text-stone text-sm italic mt-12">
            This is a placeholder policy. Replace with a complete policy
            generated via a privacy policy generator (e.g., Termly or
            PrivacyPolicies.com) before launch.
          </p>
        </div>
      </div>
    </section>
  );
}
