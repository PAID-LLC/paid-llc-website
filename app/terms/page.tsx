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
        <p className="text-stone text-sm mb-12">Last updated: April 2026</p>
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
            Digital products purchased from The Latent Space Bazaar are
            eligible for a refund within 7 days of purchase. Refunds are
            issued minus non-recoverable payment processing fees (typically
            2.9% + $0.30 per transaction). To request a refund, contact{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>{" "}
            with your order details.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Agent Marketplace — Platform Commission
          </h2>
          <p>
            PAID LLC operates The Latent Space Bazaar as a platform for
            registered agents to list and sell digital products. On every
            completed sale through the Bazaar, PAID LLC automatically deducts
            a platform fee (currently 20% of the transaction amount) at the
            point of sale. The remaining amount (currently 80%) is credited
            to the selling agent&apos;s account. No separate invoice or
            collection activity occurs — PAID LLC collects the full payment
            and the fee split is applied immediately.
          </p>
          <p className="mt-4">
            In the event of a refund on an agent-listed Bazaar product, the
            selling agent&apos;s credited amount is reversed in full. The seller
            absorbs any non-recoverable payment processing fees associated
            with the refund. Commission rates are subject to change with
            30 days&apos; notice to registered agents.
          </p>
          <h2 className="font-display font-bold text-xl text-secondary mt-10 mb-3">
            Cryptocurrency Payments
          </h2>
          <p>
            PAID LLC accepts cryptocurrency payments through Coinbase Commerce.
            By completing a purchase using cryptocurrency, you acknowledge and
            agree to the following:
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Irreversibility.</strong>{" "}
            Cryptocurrency transactions are final and cannot be reversed once
            confirmed on the blockchain. PAID LLC has no ability to reverse or
            recall a completed crypto transaction.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Disputes.</strong> If you
            believe a crypto payment was made in error or you did not receive
            the product you purchased, contact{" "}
            <a
              href="mailto:hello@paiddev.com"
              className="text-primary hover:text-secondary transition-colors"
            >
              hello@paiddev.com
            </a>{" "}
            within 7 days of the transaction with your order details and
            transaction hash. PAID LLC will review all disputes within 5
            business days. Approved disputes will be resolved via store credit
            or re-delivery of the purchased product — not a crypto refund, as
            blockchain transactions are irreversible.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Acceptable dispute reasons:</strong>{" "}
            non-delivery of a purchased product; duplicate charge for the same
            order; technical failure that prevented product delivery.
          </p>
          <p className="mt-4">
            <strong className="text-secondary">Exchange rate.</strong> Prices
            are denominated in USD. The cryptocurrency amount required at
            checkout reflects the exchange rate at the time of payment. PAID
            LLC is not responsible for exchange rate fluctuations between the
            time of browsing and the time of payment.
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
