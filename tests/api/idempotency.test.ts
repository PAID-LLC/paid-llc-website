/**
 * Tests for claimCreditGrant() — the payment-id idempotency layer for credit
 * grants (lib/idempotency.ts). Guards the money path: a duplicate webhook
 * delivery must not grant credits twice, and a missing table / outage must
 * never block a real grant (fail open).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { claimCreditGrant } from "@/lib/idempotency";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "test-service-key";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("claimCreditGrant — grant decision by insert status", () => {
  it("returns true (grant) when the row is newly inserted (201)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    expect(await claimCreditGrant("cs_new_payment")).toBe(true);
  });

  it("returns false (skip) when the payment id already exists (409)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 409 })));
    expect(await claimCreditGrant("cs_duplicate_payment")).toBe(false);
  });
});

describe("claimCreditGrant — fail open (never block a real grant)", () => {
  it("returns true when the table is missing / unexpected status (4xx-5xx other)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    expect(await claimCreditGrant("cs_no_table")).toBe(true);
  });

  it("returns true when the network call throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    expect(await claimCreditGrant("cs_network_error")).toBe(true);
  });

  it("returns true (skips the guard) when Supabase is not configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await claimCreditGrant("cs_unconfigured")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true without calling fetch when payment id is empty", async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await claimCreditGrant("")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
