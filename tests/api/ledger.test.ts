/**
 * Tests for recordSale() — the single module every sale on every payment rail
 * (Stripe, Coinbase CDP, Coinbase Commerce, x402, manual) is recorded through
 * (lib/ledger.ts).
 *
 * Why this file exists: recordSale never throws and returns a boolean that,
 * until now, every caller discarded. A Supabase outage during a completed
 * checkout therefore produced a charged customer and no ledger row, silently.
 * Stripe sales are rebuildable from the processor; latent-credit and
 * service-job sales are not rebuildable from anywhere. These tests pin the
 * contract that makes the caller-side checks meaningful.
 *
 * lib/ledger.ts imports no Next server internals, so this file tests the real
 * module directly rather than mirroring its logic (cf. the sync-risk noted in
 * tests/api/download-entitlement.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordSale, estimateFeeCents, type LedgerEntry } from "@/lib/ledger";

const ORIGINAL_ENV = { ...process.env };

function entry(over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    source:      "stripe",
    event_type:  "guide_sale",
    external_id: "cs_test_123",
    gross_cents: 999,
    ...over,
  };
}

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "test-service-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("recordSale — the return value callers branch on", () => {
  it("returns true when the row is written (201)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    expect(await recordSale(entry())).toBe(true);
  });

  it("returns true on a duplicate (200) — idempotent on external_id, row exists either way", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    expect(await recordSale(entry())).toBe(true);
  });

  it("returns false when Supabase rejects the insert (4xx)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    expect(await recordSale(entry())).toBe(false);
  });

  it("returns false when Supabase is down (5xx)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    expect(await recordSale(entry())).toBe(false);
  });

  it("returns false, and does NOT throw, when the network fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    await expect(recordSale(entry())).resolves.toBe(false);
  });
});

describe("recordSale — refuses to silently no-op", () => {
  it("returns false when Supabase env is not configured", async () => {
    delete process.env.SUPABASE_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await recordSale(entry())).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false when external_id is empty — dedupe key is mandatory", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await recordSale(entry({ external_id: "" }))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("recordSale — a lost row must be replayable from the log", () => {
  it("logs the FULL row under LOST_SALE on failure, not just the id", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));

    await recordSale(entry({
      source:      "manual",
      event_type:  "bazaar_sale",
      external_id: "svcjob_42",
      gross_cents: 250,
      agent_name:  "seller-bot",
    }));

    expect(errSpy).toHaveBeenCalled();
    const logged = errSpy.mock.calls[0].join(" ");
    expect(logged).toContain("LOST_SALE");
    // Everything needed to re-insert the row by hand:
    expect(logged).toContain("svcjob_42");
    expect(logged).toContain("bazaar_sale");
    expect(logged).toContain("seller-bot");
    expect(logged).toContain("250");
  });

  it("logs LOST_SALE on network failure too — this path previously logged nothing", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));

    await recordSale(entry({ external_id: "cs_dropped" }));

    const logged = errSpy.mock.calls[0].join(" ");
    expect(logged).toContain("LOST_SALE");
    expect(logged).toContain("network");
    expect(logged).toContain("cs_dropped");
  });
});

describe("recordSale — the row it builds", () => {
  it("derives net from gross minus fee and never emits negative money", async () => {
    let body: Record<string, number> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(null, { status: 201 });
    }));

    await recordSale(entry({ source: "stripe", gross_cents: 999 }));

    // Stripe: 2.9% + 30c on 999 = 59
    expect(body.fee_cents).toBe(estimateFeeCents("stripe", 999));
    expect(body.net_cents).toBe(999 - body.fee_cents);
    expect(body.gross_cents).toBeGreaterThanOrEqual(0);
    expect(body.net_cents).toBeGreaterThanOrEqual(0);
  });

  it("clamps net to zero when the fee exceeds a tiny gross", async () => {
    let body: Record<string, number> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(null, { status: 201 });
    }));

    await recordSale(entry({ source: "stripe", gross_cents: 5 }));
    expect(body.net_cents).toBe(0);
  });

  it("honours an explicit fee_cents instead of estimating", async () => {
    let body: Record<string, number> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(null, { status: 201 });
    }));

    // Service jobs pass the seller payout as fee_cents; net is the platform cut.
    await recordSale(entry({ source: "manual", gross_cents: 250, fee_cents: 200 }));
    expect(body.fee_cents).toBe(200);
    expect(body.net_cents).toBe(50);
  });

  it("inserts with ignore-duplicates so retried webhooks write once", async () => {
    let init: RequestInit = {};
    let url = "";
    vi.stubGlobal("fetch", vi.fn(async (u: string, i: RequestInit) => {
      url = u; init = i;
      return new Response(null, { status: 201 });
    }));

    await recordSale(entry());

    expect(url).toContain("on_conflict=external_id");
    expect((init.headers as Record<string, string>).Prefer).toContain("ignore-duplicates");
  });
});

describe("estimateFeeCents", () => {
  it("charges Stripe 2.9% + 30c", () => {
    expect(estimateFeeCents("stripe", 1000)).toBe(59);
  });

  it("charges Coinbase 1%", () => {
    expect(estimateFeeCents("coinbase_commerce", 1000)).toBe(10);
    expect(estimateFeeCents("coinbase_cdp", 1000)).toBe(10);
  });

  it("charges nothing on x402 and manual rails", () => {
    expect(estimateFeeCents("x402", 1000)).toBe(0);
    expect(estimateFeeCents("manual", 1000)).toBe(0);
  });

  it("returns zero for a zero or negative gross", () => {
    expect(estimateFeeCents("stripe", 0)).toBe(0);
    expect(estimateFeeCents("stripe", -100)).toBe(0);
  });
});
