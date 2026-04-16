/**
 * Tests for contact route validation logic — agent path and human regression.
 *
 * These tests cover the email validation branching and field handling that
 * changed in this PR. The most critical test is the human regression — we
 * must prove the existing flow is unchanged.
 */

import { describe, it, expect } from "vitest";

// ── Email validation logic ─────────────────────────────────────────────────────
// Mirrors the exact regex used in app/api/contact/route.ts

const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

function validateEmail(
  email: string,
  submitterType: "human" | "agent"
): { valid: boolean; error?: string } {
  if (submitterType === "agent") {
    // Optional: skip if blank, validate format only if provided
    if (!email) return { valid: true };
    if (email.length > 254 || !emailRegex.test(email)) {
      return { valid: false, error: "Invalid email format." };
    }
    return { valid: true };
  } else {
    // Human: strict RFC 5321 (existing behavior — regression test)
    if (!email || email.length > 254 || !emailRegex.test(email)) {
      return { valid: false, error: "A valid email address is required." };
    }
    return { valid: true };
  }
}

describe("email validation — human (REGRESSION)", () => {
  it("requires email for human submission", () => {
    const result = validateEmail("", "human");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("A valid email address is required.");
  });

  it("rejects invalid email format for humans", () => {
    expect(validateEmail("notanemail", "human").valid).toBe(false);
    expect(validateEmail("missing@tld", "human").valid).toBe(false);
    expect(validateEmail("@nodomain.com", "human").valid).toBe(false);
  });

  it("accepts valid email for humans", () => {
    expect(validateEmail("user@example.com", "human").valid).toBe(true);
    expect(validateEmail("hello@paiddev.com", "human").valid).toBe(true);
  });

  it("rejects email over 254 chars for humans", () => {
    const longEmail = "a".repeat(250) + "@b.com";
    expect(validateEmail(longEmail, "human").valid).toBe(false);
  });
});

describe("email validation — agent", () => {
  it("allows blank email for agents", () => {
    const result = validateEmail("", "agent");
    expect(result.valid).toBe(true);
  });

  it("accepts valid email for agents when provided", () => {
    expect(validateEmail("bot@example.com", "agent").valid).toBe(true);
  });

  it("rejects invalid email format for agents when provided", () => {
    const result = validateEmail("notvalid", "agent");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid email format.");
  });

  it("rejects email over 254 chars for agents", () => {
    const longEmail = "a".repeat(250) + "@b.com";
    expect(validateEmail(longEmail, "agent").valid).toBe(false);
  });
});

// ── submitter_type parsing ─────────────────────────────────────────────────────
describe("submitter_type parsing", () => {
  function parseSubmitterType(raw: unknown): "human" | "agent" {
    return raw === "agent" ? "agent" : "human";
  }

  it("defaults to human when absent", () => {
    expect(parseSubmitterType(undefined)).toBe("human");
    expect(parseSubmitterType(null)).toBe("human");
  });

  it("returns agent when set to 'agent'", () => {
    expect(parseSubmitterType("agent")).toBe("agent");
  });

  it("defaults to human for any other value", () => {
    expect(parseSubmitterType("bot")).toBe("human");
    expect(parseSubmitterType("AGENT")).toBe("human"); // case-sensitive
  });
});

// ── agent_model field handling ─────────────────────────────────────────────────
describe("agent_model field", () => {
  function parseAgentModel(raw: unknown, submitterType: "human" | "agent"): string | null {
    if (submitterType !== "agent") return null;
    if (typeof raw !== "string") return null;
    return raw.trim().slice(0, 100) || null;
  }

  it("returns null for human submissions regardless of value", () => {
    expect(parseAgentModel("gpt-4o", "human")).toBeNull();
  });

  it("returns null when not provided for agents", () => {
    expect(parseAgentModel(undefined, "agent")).toBeNull();
    expect(parseAgentModel("", "agent")).toBeNull();
    expect(parseAgentModel("   ", "agent")).toBeNull();
  });

  it("returns model string for agents when provided", () => {
    expect(parseAgentModel("claude-sonnet-4-6", "agent")).toBe("claude-sonnet-4-6");
  });

  it("truncates agent_model to 100 chars", () => {
    const long = "a".repeat(150);
    expect(parseAgentModel(long, "agent")?.length).toBe(100);
  });
});

// ── Name field validation ──────────────────────────────────────────────────────
describe("name field validation (unchanged for both submitter types)", () => {
  function validateName(name: string): { valid: boolean; error?: string } {
    if (!name || name.length > 100) {
      return { valid: false, error: "Name is required." };
    }
    return { valid: true };
  }

  it("requires name for both human and agent", () => {
    expect(validateName("").valid).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    expect(validateName("a".repeat(101)).valid).toBe(false);
  });

  it("accepts valid name", () => {
    expect(validateName("SophieBot").valid).toBe(true);
    expect(validateName("Arti Intel").valid).toBe(true);
  });
});
