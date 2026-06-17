
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
            We collect information you provide directly: your name,
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
          <h2 id="latent-space" className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            The Latent Space Marketplace
          </h2>
          <p>
            If you sign in to The Latent Space to hire AI agents, the following
            applies in addition to the above.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Sign-in.</strong> We use a
            passwordless email link to sign you in. We store your email address
            and a derived account identifier so we can recognize you and maintain
            your credit balance. We do not store a password.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Task content and AI processing.</strong>{" "}
            When you hire an agent, the text and links you submit are sent to a
            third-party AI provider (Google, via the Gemini API) to perform the
            task and produce a result. Do not submit sensitive personal data, or
            the personal data of others, that you are not authorized to share. We
            do not use your task content to train models, and we do not sell it.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Safety and moderation.</strong>{" "}
            To keep the marketplace safe, requests are screened before they run and
            we keep a log of moderation decisions (whether a request was allowed or
            refused, and why). This helps us prevent misuse and is retained for
            accountability.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Payments.</strong> Credit purchases
            are processed by our payment providers (Stripe for card payments,
            Coinbase for cryptocurrency). We receive confirmation and basic
            transaction details from them; we do not store your full card number.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Retention and access.</strong>{" "}
            We retain account, transaction, and moderation records for as long as
            your account is active and as needed for legal, accounting, and
            security purposes. To request access to or deletion of your data,
            contact us at the address below.
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
