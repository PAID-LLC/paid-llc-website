import { describe, it, expect } from "vitest";
import {
  HOUSE_ENTRANTS,
  HOUSE_PREFIX,
  LADDER_EPOCH_MS,
  LADDER_DISCLOSURE,
  LADDER_START_RATING,
  MATCH_INTERVAL_MINUTES,
  PLINTH_QUALIFY_STREAK,
  boutAt,
  buildLadderState,
  isHouseAgent,
  matchesSince,
  resolveBout,
} from "@/lib/crucible/house-ladder";
import { GRADER_VERSION, TASKS } from "@/lib/arena/proving-ground";

const MIN = 60_000;
const hoursAfterEpoch = (h: number) => LADDER_EPOCH_MS + h * 60 * MIN;

describe("house ladder: scheduling", () => {
  it("no bouts have completed at or before the epoch", () => {
    expect(matchesSince(LADDER_EPOCH_MS)).toBe(0);
    expect(matchesSince(LADDER_EPOCH_MS - 1)).toBe(0);
  });

  it("one bout completes per interval", () => {
    expect(matchesSince(LADDER_EPOCH_MS + MATCH_INTERVAL_MINUTES * MIN - 1)).toBe(0);
    expect(matchesSince(LADDER_EPOCH_MS + MATCH_INTERVAL_MINUTES * MIN)).toBe(1);
    expect(matchesSince(LADDER_EPOCH_MS + 3 * MATCH_INTERVAL_MINUTES * MIN)).toBe(3);
  });

  it("is monotonic in time", () => {
    let prev = 0;
    for (let h = 0; h <= 72; h += 3) {
      const n = matchesSince(hoursAfterEpoch(h));
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it("never pairs an entrant against itself, across a long run", () => {
    for (let i = 0; i < 2000; i++) {
      const b = boutAt(i);
      expect(b.a.name, `bout ${i}`).not.toBe(b.b.name);
    }
  });

  it("draws only from the real task bank", () => {
    const ids = new Set(TASKS.map((t) => t.id));
    for (let i = 0; i < 500; i++) {
      expect(ids.has(boutAt(i).task.id)).toBe(true);
    }
  });

  it("is reproducible from the index alone", () => {
    for (const i of [0, 1, 7, 99, 1234]) {
      const a = boutAt(i);
      const b = boutAt(i);
      expect(a.a.name).toBe(b.a.name);
      expect(a.b.name).toBe(b.b.name);
      expect(a.task.id).toBe(b.task.id);
      expect(a.atMs).toBe(b.atMs);
    }
  });

  it("uses every entrant and every task over a long enough run", () => {
    const seenAgents = new Set<string>();
    const seenTasks = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const b = boutAt(i);
      seenAgents.add(b.a.name);
      seenAgents.add(b.b.name);
      seenTasks.add(b.task.id);
    }
    expect(seenAgents.size).toBe(HOUSE_ENTRANTS.length);
    expect(seenTasks.size).toBe(TASKS.length);
  });
});

describe("house ladder: bout resolution really grades", () => {
  it("a declined task grades as a loss, not a free pass", () => {
    // Lexer has no SQL in its playbook; Ledger does. Find such a bout.
    const lexer = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Lexer`)!;
    const ledger = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Ledger`)!;
    const sqlTask = TASKS.find((t) => t.id === "sql-second-highest")!;

    const res = resolveBout({ index: 0, atMs: LADDER_EPOCH_MS, a: lexer, b: ledger, task: sqlTask });
    expect(res.winner).toBe(ledger.name);
    expect(res.loser).toBe(lexer.name);
    expect(res.a_score).toBe(0);
    expect(res.b_score).toBe(1);
    expect(res.grader).toBe(GRADER_VERSION);
  });

  it("the permissive-regex profile earns real partial credit", () => {
    const greedy = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Greedy`)!;
    const anchor = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Anchor`)!;
    const hex = TASKS.find((t) => t.id === "rx-hex-color")!;

    const res = resolveBout({ index: 1, atMs: LADDER_EPOCH_MS, a: greedy, b: anchor, task: hex });
    expect(res.a_score).toBeGreaterThan(0);
    expect(res.a_score).toBeLessThan(1);
    expect(res.b_score).toBe(1);
    expect(res.winner).toBe(anchor.name);
  });

  it("the fast-intuition profile really loses the classic traps", () => {
    const reflex = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Reflex`)!;
    const anchor = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Anchor`)!;
    for (const id of ["logic-bat-ball", "arith-compound", "arith-machines", "logic-monty"]) {
      const task = TASKS.find((t) => t.id === id)!;
      const res = resolveBout({ index: 2, atMs: LADDER_EPOCH_MS, a: reflex, b: anchor, task });
      expect(res.winner, id).toBe(anchor.name);
    }
  });

  it("identical answers draw", () => {
    const anchor = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Anchor`)!;
    const lexer = HOUSE_ENTRANTS.find((e) => e.name === `${HOUSE_PREFIX}Lexer`)!;
    const hex = TASKS.find((t) => t.id === "rx-hex-color")!;
    const res = resolveBout({ index: 3, atMs: LADDER_EPOCH_MS, a: anchor, b: lexer, task: hex });
    expect(res.drawn).toBe(true);
    expect(res.winner).toBeNull();
    expect(res.loser).toBeNull();
  });
});

describe("house ladder: standings", () => {
  it("before the epoch, everyone is level and nothing has run", () => {
    const s = buildLadderState(LADDER_EPOCH_MS);
    expect(s.bouts_total).toBe(0);
    expect(s.bouts_replayed).toBe(0);
    expect(s.standings).toHaveLength(HOUSE_ENTRANTS.length);
    for (const row of s.standings) {
      expect(row.rating).toBe(LADDER_START_RATING);
      expect(row.bouts).toBe(0);
      expect(row.last_bout_at).toBeNull();
    }
  });

  it("carries the disclosure and grader version on every read", () => {
    const s = buildLadderState(hoursAfterEpoch(48));
    expect(s.disclosure).toBe(LADDER_DISCLOSURE);
    expect(s.disclosure).toMatch(/House exhibition/);
    expect(s.grader).toBe(GRADER_VERSION);
  });

  it("Elo is zero-sum across the field", () => {
    const s = buildLadderState(hoursAfterEpoch(200));
    const total = s.standings.reduce((n, r) => n + r.rating, 0);
    expect(total).toBe(LADDER_START_RATING * HOUSE_ENTRANTS.length);
  });

  it("win/loss/draw counts reconcile with bouts played", () => {
    const s = buildLadderState(hoursAfterEpoch(200));
    for (const r of s.standings) {
      expect(r.wins + r.losses + r.draws, r.agent_name).toBe(r.bouts);
    }
    const totalSlots = s.standings.reduce((n, r) => n + r.bouts, 0);
    expect(totalSlots).toBe(s.bouts_replayed * 2);
  });

  it("accuracy stays inside 0..1", () => {
    const s = buildLadderState(hoursAfterEpoch(500));
    for (const r of s.standings) {
      expect(r.accuracy).toBeGreaterThanOrEqual(0);
      expect(r.accuracy).toBeLessThanOrEqual(1);
    }
  });

  it("standings are sorted by rating descending", () => {
    const s = buildLadderState(hoursAfterEpoch(500));
    for (let i = 1; i < s.standings.length; i++) {
      expect(s.standings[i - 1].rating).toBeGreaterThanOrEqual(s.standings[i].rating);
    }
  });

  it("the careful generalist outranks the fast-intuition profile over time", () => {
    // Not a tautology: it has to come out of real graded bouts.
    const s = buildLadderState(hoursAfterEpoch(720));
    const rank = (n: string) => s.standings.findIndex((r) => r.agent_name === n);
    expect(rank(`${HOUSE_PREFIX}Anchor`)).toBeLessThan(rank(`${HOUSE_PREFIX}Reflex`));
  });

  it("replay is bounded by the limit", () => {
    const s = buildLadderState(hoursAfterEpoch(24 * 365), HOUSE_ENTRANTS, 50);
    expect(s.bouts_replayed).toBe(50);
    expect(s.bouts_total).toBeGreaterThan(50);
  });

  it("recent results are newest-first and within the recent count", () => {
    const s = buildLadderState(hoursAfterEpoch(200));
    expect(s.recent.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < s.recent.length; i++) {
      expect(s.recent[i - 1].index).toBeGreaterThan(s.recent[i].index);
    }
  });

  it("always names a bout in progress once the epoch has passed", () => {
    const s = buildLadderState(hoursAfterEpoch(10));
    expect(s.in_progress).not.toBeNull();
    expect(s.in_progress!.a).not.toBe(s.in_progress!.b);
    expect(s.in_progress!.task_prompt.length).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed clock", () => {
    const t = hoursAfterEpoch(333);
    expect(buildLadderState(t)).toEqual(buildLadderState(t));
  });

  it("a qualifying streak records a reign start, and a loss clears it", () => {
    const s = buildLadderState(hoursAfterEpoch(400));
    for (const r of s.standings) {
      if (r.win_streak >= 2) expect(r.reign_start, r.agent_name).not.toBeNull();
      if (r.win_streak === 0) expect(r.reign_start, r.agent_name).toBeNull();
    }
  });
});

describe("house ladder: plinth occupancy", () => {
  const occupancyAt = (h: number) =>
    buildLadderState(hoursAfterEpoch(h)).standings.filter(
      (r) => r.win_streak >= PLINTH_QUALIFY_STREAK
    ).length;

  it("never exceeds the field", () => {
    for (let h = 1; h <= 240; h += 7) {
      expect(occupancyAt(h)).toBeLessThanOrEqual(HOUSE_ENTRANTS.length);
    }
  });

  it("keeps the ring populated, sampled at every single bout", () => {
    // The whole reason this layer exists is that the ring was empty on every
    // visit. Sampled per bout rather than every few hours: a coarse sample hid
    // a 6% empty-ring rate that was immediately visible in production.
    const samples: number[] = [];
    for (let i = 1; i <= 600; i++) {
      samples.push(
        buildLadderState(LADDER_EPOCH_MS + i * MATCH_INTERVAL_MINUTES * MIN).standings.filter(
          (r) => r.win_streak >= PLINTH_QUALIFY_STREAK
        ).length
      );
    }
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const emptyRate = samples.filter((n) => n === 0).length / samples.length;
    expect(mean).toBeGreaterThan(2.5);
    expect(emptyRate).toBeLessThan(0.01);
  });

  it("never unseats an entrant that has not been beaten", () => {
    // A draw is not a defeat. This regressed once: an 8-0-7 undefeated entrant
    // held no plinth because its most recent bout was a draw.
    for (let i = 1; i <= 600; i++) {
      const st = buildLadderState(LADDER_EPOCH_MS + i * MATCH_INTERVAL_MINUTES * MIN);
      for (const r of st.standings) {
        if (r.losses === 0 && r.wins > 0) {
          expect(r.win_streak, `${r.agent_name} undefeated at bout ${i}`).toBeGreaterThanOrEqual(
            PLINTH_QUALIFY_STREAK
          );
        }
      }
    }
  });

  it("turns over rather than freezing on one entrant", () => {
    const holders = new Set<string>();
    for (let h = 4; h <= 480; h += 4) {
      for (const r of buildLadderState(hoursAfterEpoch(h)).standings) {
        if (r.win_streak >= PLINTH_QUALIFY_STREAK) holders.add(r.agent_name);
      }
    }
    expect(holders.size).toBeGreaterThan(2);
  });
});

describe("house ladder: honesty contract", () => {
  it("every entrant is identifiable as house-operated by name alone", () => {
    for (const e of HOUSE_ENTRANTS) {
      expect(isHouseAgent(e.name), e.name).toBe(true);
      expect(e.name.startsWith(HOUSE_PREFIX)).toBe(true);
    }
  });

  it("does not claim third-party agents are house agents", () => {
    expect(isHouseAgent("ClaudeOpus-Cowork")).toBe(false);
    expect(isHouseAgent("OpenClaw")).toBe(false);
    expect(isHouseAgent("")).toBe(false);
  });

  it("every entrant has a blurb describing its strategy", () => {
    for (const e of HOUSE_ENTRANTS) {
      expect(e.blurb.length, e.name).toBeGreaterThan(10);
    }
  });

  it("no entrant is perfect: the exhibition has to be losable", () => {
    for (const e of HOUSE_ENTRANTS) {
      const answered = Object.keys(e.playbook).length;
      expect(answered, e.name).toBeLessThan(TASKS.length + 1);
    }
    // And at least one entrant must be beatable on at least one task.
    const s = buildLadderState(hoursAfterEpoch(400));
    expect(s.standings.some((r) => r.losses > 0)).toBe(true);
  });
});
