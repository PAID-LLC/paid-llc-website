/**
 * Regression tests for the digital-guide download entitlement check.
 *
 * Guards against the entitlement bypass fixed in app/download/[slug]/page.tsx:
 * verifying only payment_status === "paid" let any valid paid session_id be
 * replayed against a different slug, unlocking the entire catalog for the price
 * of one guide. The fix requires session.metadata.product to equal the slug
 * being requested.
 *
 * This mirrors verifyStripeSession() from app/download/[slug]/page.tsx (the route
 * module pulls in Next server internals, so — matching tests/api/contact.test.ts
 * — the decision logic is reproduced here and must be kept in sync with the route).
 */

import { describe, it, expect } from "vitest";

type StripeSession = {
  payment_status: string;
  metadata?: { product?: string } | null;
};

/** Mirror of verifyStripeSession() in app/download/[slug]/page.tsx. */
function isEntitled(session: StripeSession, slug: string): boolean {
  if (session.payment_status !== "paid") return false;
  return session.metadata?.product === slug;
}

describe("download entitlement — paid session for the SAME product", () => {
  it("allows the buyer to download the guide they paid for", () => {
    const session = { payment_status: "paid", metadata: { product: "excel-ai-data-analysis" } };
    expect(isEntitled(session, "excel-ai-data-analysis")).toBe(true);
  });

  it("allows a bundle buyer to download the bundle slug", () => {
    const session = { payment_status: "paid", metadata: { product: "all-guides-bundle" } };
    expect(isEntitled(session, "all-guides-bundle")).toBe(true);
  });
});

describe("download entitlement — bypass attempts (REGRESSION)", () => {
  it("rejects a paid session replayed against a DIFFERENT slug", () => {
    // Bought the $9.99 guide, tries to grab the $29.99 enterprise guide.
    const session = { payment_status: "paid", metadata: { product: "ai-powered-outlook" } };
    expect(isEntitled(session, "enterprise-ai-deployment-guide")).toBe(false);
  });

  it("rejects a single-guide session replayed against the bundle", () => {
    const session = { payment_status: "paid", metadata: { product: "gmail-ai-inbox-zero" } };
    expect(isEntitled(session, "all-guides-bundle")).toBe(false);
  });

  it("rejects a paid session with no product metadata", () => {
    expect(isEntitled({ payment_status: "paid", metadata: {} }, "excel-ai-data-analysis")).toBe(false);
    expect(isEntitled({ payment_status: "paid", metadata: null }, "excel-ai-data-analysis")).toBe(false);
    expect(isEntitled({ payment_status: "paid" }, "excel-ai-data-analysis")).toBe(false);
  });
});

describe("download entitlement — unpaid sessions", () => {
  it("rejects an unpaid session even when the product matches", () => {
    const session = { payment_status: "unpaid", metadata: { product: "excel-ai-data-analysis" } };
    expect(isEntitled(session, "excel-ai-data-analysis")).toBe(false);
  });

  it("rejects a session still awaiting payment", () => {
    const session = { payment_status: "no_payment_required", metadata: { product: "excel-ai-data-analysis" } };
    expect(isEntitled(session, "excel-ai-data-analysis")).toBe(false);
  });
});
