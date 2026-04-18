# Client Agent Update Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tier/fee tracking columns to `client_agents` and build `PATCH /api/agents/[agent_name]` so PAID LLC can update a deployed client agent's personality, catalog, status, and billing tier.

**Architecture:** Two-part: (1) a SQL migration that adds three nullable columns to the existing `client_agents` table; (2) an admin-only PATCH edge route that accepts partial updates and writes them back to Supabase via the REST API. Auth pattern mirrors the existing register route (`x-admin-secret` header + timing-safe compare).

**Tech Stack:** Next.js 15 App Router, edge runtime, Supabase REST API, `lib/supabase.ts` helpers, `lib/agents/client-agents.ts` types.

---

## Context: What Already Exists

- `client_agents` table — live in Supabase with columns: `id`, `name`, `model_class`, `room_id`, `room_theme`, `personality`, `client_name`, `agent_secret_hash`, `active`
- `POST /api/agents/register` — fully built, auth via `x-admin-secret` header
- `lib/agents/client-agents.ts` — `getClientAgent()` and `nextClientRoomId()` helpers
- `lib/supabase.ts` — `sbHeaders()`, `sbUrl()`, `supabaseReady()`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `db/add-tier-columns.sql` | **Create** | Migration: add `tier`, `monthly_fee_cents`, `setup_fee_cents` to `client_agents` |
| `app/api/agents/[agent_name]/route.ts` | **Create** | PATCH handler: admin-authenticated partial update for a client agent |
| `lib/agents/client-agents.ts` | **Modify** | Add `tier`, `monthly_fee_cents`, `setup_fee_cents` to `ClientAgent` interface |

---

## Task 1: SQL Migration File

**Files:**
- Create: `db/add-tier-columns.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add tier/fee tracking columns to client_agents
-- Run in Supabase SQL Editor (safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

ALTER TABLE client_agents
  ADD COLUMN IF NOT EXISTS tier              TEXT    DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS monthly_fee_cents INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS setup_fee_cents   INTEGER DEFAULT NULL;

-- Optional: add a check constraint to enforce valid tiers
ALTER TABLE client_agents
  DROP CONSTRAINT IF EXISTS client_agents_tier_check;
ALTER TABLE client_agents
  ADD CONSTRAINT client_agents_tier_check
  CHECK (tier IN ('starter', 'standard', 'custom'));
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste the above → Run.

Expected result: "Success. No rows returned." (or equivalent success message). If columns already exist, `ADD COLUMN IF NOT EXISTS` is a no-op.

- [ ] **Step 3: Verify columns exist**

In Supabase Table Editor, open `client_agents`. Confirm three new columns visible:
- `tier` (text, default: 'starter')
- `monthly_fee_cents` (int4, nullable)
- `setup_fee_cents` (int4, nullable)

---

## Task 2: Update ClientAgent Interface

**Files:**
- Modify: `lib/agents/client-agents.ts` (lines 11–20)

- [ ] **Step 1: Add new fields to the interface**

Current interface (lines 11–20):
```typescript
export interface ClientAgent {
  id:          number;
  name:        string;
  model_class: string;
  room_id:     number;
  room_theme:  string;
  personality: string;
  client_name: string | null;
  active:      boolean;
}
```

Replace with:
```typescript
export interface ClientAgent {
  id:                 number;
  name:               string;
  model_class:        string;
  room_id:            number;
  room_theme:         string;
  personality:        string;
  client_name:        string | null;
  active:             boolean;
  tier:               "starter" | "standard" | "custom";
  monthly_fee_cents:  number | null;
  setup_fee_cents:    number | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/agents/client-agents.ts db/add-tier-columns.sql
git commit -m "feat: add tier/fee columns to client_agents schema and interface"
```

---

## Task 3: PATCH /api/agents/[agent_name] Route

**Files:**
- Create: `app/api/agents/[agent_name]/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "app/api/agents/[agent_name]"
```

- [ ] **Step 2: Write the route**

Create `app/api/agents/[agent_name]/route.ts`:

```typescript
export const runtime = "edge";

// ── PATCH /api/agents/[agent_name] ────────────────────────────────────────────
//
// Admin-only endpoint to update a deployed client agent.
// Protected by x-admin-secret header (same as register route).
//
// Accepted fields (all optional — only provided fields are updated):
//   personality:        string   — new system prompt
//   room_theme:         string   — visual theme override
//   active:             boolean  — deactivate (false) or reactivate (true)
//   tier:               "starter" | "standard" | "custom"
//   monthly_fee_cents:  number
//   setup_fee_cents:    number
//
// Response:
//   { ok: true, agent_name, updated: string[] }

import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";

const enc = new TextEncoder();

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const arrA = new Uint8Array(hashA);
  const arrB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < arrA.length; i++) diff |= arrA[i] ^ arrB[i];
  return diff === 0;
}

const VALID_TIERS = new Set(["starter", "standard", "custom"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agent_name: string }> }
) {
  if (!supabaseReady()) {
    return Response.json({ ok: false, reason: "supabase unavailable" }, { status: 503 });
  }

  // ── Admin auth ──────────────────────────────────────────────────────────
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return Response.json({ ok: false, reason: "admin not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("x-admin-secret") ?? "";
  if (!(await timingSafeEqual(authHeader, adminSecret))) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const { agent_name } = await params;
  if (!agent_name) {
    return Response.json({ ok: false, reason: "agent_name required" }, { status: 400 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Response.json({ ok: false, reason: "invalid body" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  const updated: string[] = [];

  if (typeof body.personality === "string" && body.personality.trim()) {
    patch.personality = body.personality.trim();
    updated.push("personality");
  }
  if (typeof body.room_theme === "string" && body.room_theme.trim()) {
    patch.room_theme = body.room_theme.trim();
    updated.push("room_theme");
  }
  if (typeof body.active === "boolean") {
    patch.active = body.active;
    updated.push("active");
  }
  if (typeof body.tier === "string" && VALID_TIERS.has(body.tier)) {
    patch.tier = body.tier;
    updated.push("tier");
  }
  if (typeof body.monthly_fee_cents === "number" && body.monthly_fee_cents >= 0) {
    patch.monthly_fee_cents = Math.floor(body.monthly_fee_cents);
    updated.push("monthly_fee_cents");
  }
  if (typeof body.setup_fee_cents === "number" && body.setup_fee_cents >= 0) {
    patch.setup_fee_cents = Math.floor(body.setup_fee_cents);
    updated.push("setup_fee_cents");
  }

  if (updated.length === 0) {
    return Response.json({ ok: false, reason: "no valid fields to update" }, { status: 400 });
  }

  // ── PATCH client_agents ─────────────────────────────────────────────────
  const patchRes = await fetch(
    sbUrl(`client_agents?name=eq.${encodeURIComponent(agent_name)}`),
    {
      method:  "PATCH",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body:    JSON.stringify(patch),
    }
  );

  if (!patchRes.ok) {
    const detail = await patchRes.text().catch(() => "");
    console.error("[agent-update] patch failed:", patchRes.status, detail);
    return Response.json({ ok: false, reason: "update_failed" }, { status: 500 });
  }

  return Response.json({ ok: true, agent_name, updated });
}
```

- [ ] **Step 3: Verify the route compiles**

```bash
cd "C:/Users/MyAIE/OneDrive/Desktop/paid-llc-website" && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If TypeScript complains about `params` being a `Promise`, that is correct for Next.js 15 — it is already handled with `await params` in the route.

- [ ] **Step 4: Commit**

```bash
git add "app/api/agents/[agent_name]/route.ts"
git commit -m "feat: add PATCH /api/agents/[agent_name] admin update route"
```

---

## Task 4: Smoke Test + Deploy

- [ ] **Step 1: Confirm env var is set locally**

```bash
grep ADMIN_SECRET "C:/Users/MyAIE/OneDrive/Desktop/paid-llc-website/.env.local"
```

Expected: line with `ADMIN_SECRET=<your-secret>` (non-empty).

- [ ] **Step 2: Start dev server**

```bash
cd "C:/Users/MyAIE/OneDrive/Desktop/paid-llc-website" && npm run dev 2>&1 &
```

Wait ~5 seconds for server to start on `http://localhost:3000`.

- [ ] **Step 3: Test PATCH with a known agent name**

Replace `<ADMIN_SECRET>` and `<AGENT_NAME>` with your actual values:

```bash
curl -s -X PATCH http://localhost:3000/api/agents/<AGENT_NAME> \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"tier":"standard","monthly_fee_cents":22500}' | jq .
```

Expected response:
```json
{
  "ok": true,
  "agent_name": "<AGENT_NAME>",
  "updated": ["tier", "monthly_fee_cents"]
}
```

- [ ] **Step 4: Test unauthorized rejection**

```bash
curl -s -X PATCH http://localhost:3000/api/agents/<AGENT_NAME> \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: wrong-secret" \
  -d '{"active":false}' | jq .
```

Expected: `{ "ok": false, "reason": "unauthorized" }` with HTTP 401.

- [ ] **Step 5: Push to deploy**

```bash
git push origin main
```

Cloudflare Pages auto-deploys on push. No additional steps.

---

## Self-Review Checklist

- [x] SQL migration uses `ADD COLUMN IF NOT EXISTS` — safe to re-run
- [x] PATCH route follows exact same auth pattern as register route (`x-admin-secret` + timing-safe)
- [x] Dynamic route uses `await params` — correct for Next.js 15 (params is a Promise)
- [x] No fields are silently accepted — unknown fields are ignored, not patched
- [x] Empty `patch` object returns 400 before hitting Supabase
- [x] Partial updates — only the provided fields are written; missing fields are not overwritten
- [x] Tier validation uses a Set — prevents arbitrary strings from reaching the DB
