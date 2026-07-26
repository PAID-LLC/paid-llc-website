import { describe, it, expect } from "vitest";
import {
  GRADER_VERSION,
  TASKS,
  canonNumber,
  canonSql,
  canonText,
  extractPattern,
  gradeTask,
  patternIsSafe,
  taskById,
  tasksByKind,
  MAX_PATTERN_CHARS,
} from "@/lib/arena/proving-ground";

describe("proving ground: canonicalizers", () => {
  it("canonText folds case, whitespace and terminal punctuation", () => {
    expect(canonText("  Truth   Teller.  ")).toBe("truth teller");
    expect(canonText("2/3")).toBe("2/3");
  });

  it("canonSql tolerates formatting variance but not different queries", () => {
    const a = canonSql("SELECT status, COUNT(*) AS n\n  FROM orders\n GROUP BY status;");
    const b = canonSql("select status,count(*) as n from orders group by status");
    expect(a).toBe(b);

    // Dropping the GROUP BY is a different query and must not canonicalize equal.
    expect(canonSql("select status, count(*) as n from orders")).not.toBe(a);
  });

  it("canonSql strips comments and normalizes quotes", () => {
    expect(canonSql(`SELECT "id" FROM t -- trailing note`)).toBe("select 'id' from t");
  });

  it("canonNumber compares numerically, not textually", () => {
    expect(canonNumber("42")).toBe("42");
    expect(canonNumber("42.0")).toBe("42");
    expect(canonNumber("the answer is 42")).toBe("42");
    expect(canonNumber("1,000")).toBe("1000");
    expect(canonNumber("no digits here")).toBeNull();
  });
});

describe("proving ground: the substring exploit is closed", () => {
  // The old sudden-death grader accepted an answer when EITHER string contained
  // the other, so submitting a single common character won essentially any
  // puzzle. Every exact-form task must reject that.
  const exactTasks = TASKS.filter((t) => t.spec.kind === "exact");

  it("has exact-form tasks to check", () => {
    expect(exactTasks.length).toBeGreaterThan(0);
  });

  for (const task of exactTasks) {
    it(`${task.id} rejects a single-character answer`, () => {
      for (const ch of ["e", "s", "1", "t", "/"]) {
        expect(gradeTask(task, ch).correct).toBe(false);
      }
    });

    it(`${task.id} rejects a strict prefix of the answer`, () => {
      const answer = (task.spec as { accept: string[] }).accept[0];
      if (answer.length < 4) return;
      const prefix = answer.slice(0, Math.max(1, Math.floor(answer.length / 2)));
      if ((task.spec as { canon: string }).canon === "number") return;
      expect(gradeTask(task, prefix).correct).toBe(false);
    });
  }
});

describe("proving ground: regex grading", () => {
  const hex = taskById("rx-hex-color")!;

  it("a correct anchored pattern scores every vector", () => {
    const r = gradeTask(hex, "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$");
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1);
    expect(r.passed).toBe(r.total);
    expect(r.grader).toBe(GRADER_VERSION);
  });

  it("a permissive pattern earns partial credit, not a pass", () => {
    const r = gradeTask(hex, "#[0-9a-fA-F]*");
    expect(r.correct).toBe(false);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(1);
  });

  it("reject vectors carry real signal: .* cannot pass", () => {
    const r = gradeTask(hex, ".*");
    expect(r.correct).toBe(false);
    // Passes all accept vectors, fails all reject vectors.
    expect(r.passed).toBe((hex.spec as { accept: string[] }).accept.length);
  });

  it("an invalid regex scores zero rather than throwing", () => {
    const r = gradeTask(hex, "([unclosed");
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
    expect(r.detail).toMatch(/valid regular expression/);
  });

  it("strips a /pattern/flags wrapper and drops the flags", () => {
    expect(extractPattern("/^#[0-9a-f]{3}$/gi")).toBe("^#[0-9a-f]{3}$");
    expect(extractPattern("  ^abc$  ")).toBe("^abc$");
    // `i` must not leak through, or a pattern could sidestep case-sensitive
    // reject vectors.
    const r = gradeTask(hex, "/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/i");
    expect(r.correct).toBe(true);
  });

  it("an empty response scores zero on every task", () => {
    for (const t of TASKS) {
      const r = gradeTask(t, "   ");
      expect(r.correct).toBe(false);
      expect(r.score).toBe(0);
      expect(r.total).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("proving ground: regex safety guard", () => {
  it("rejects nested quantifiers", () => {
    expect(patternIsSafe("(a+)+$").safe).toBe(false);
    expect(patternIsSafe("(a*)*").safe).toBe(false);
  });

  it("rejects over-long patterns", () => {
    expect(patternIsSafe("a".repeat(MAX_PATTERN_CHARS + 1)).safe).toBe(false);
  });

  it("accepts the ordinary anchored patterns the bank expects", () => {
    expect(patternIsSafe("^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$").safe).toBe(true);
    expect(patternIsSafe("\\b(\\w+) \\1\\b").safe).toBe(true);
  });

  it("an unsafe pattern grades as zero, it does not throw", () => {
    const r = gradeTask(taskById("rx-hex-color")!, "(a+)+");
    expect(r.score).toBe(0);
    expect(r.detail).toMatch(/backtracking/);
  });
});

describe("proving ground: task bank integrity", () => {
  it("task ids are unique", () => {
    const ids = TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every regex task carries both accept and reject vectors", () => {
    for (const t of TASKS) {
      if (t.spec.kind !== "regex") continue;
      expect(t.spec.accept.length, t.id).toBeGreaterThan(0);
      expect(t.spec.reject.length, t.id).toBeGreaterThan(0);
    }
  });

  it("every task's own first accepted answer grades correct", () => {
    // Guards the bank against a typo in its own answer key.
    for (const t of TASKS) {
      if (t.spec.kind === "regex") continue;
      const first = t.spec.accept[0];
      expect(gradeTask(t, first).correct, `${t.id} <- ${first}`).toBe(true);
    }
  });

  it("every accepted SQL variant grades correct", () => {
    for (const t of TASKS) {
      if (t.spec.kind !== "exact" || t.spec.canon !== "sql") continue;
      for (const variant of t.spec.accept) {
        expect(gradeTask(t, variant).correct, `${t.id} <- ${variant}`).toBe(true);
      }
    }
  });

  it("grading is deterministic", () => {
    for (const t of TASKS) {
      const a = gradeTask(t, "^#[0-9a-f]{3}$");
      const b = gradeTask(t, "^#[0-9a-f]{3}$");
      expect(a).toEqual(b);
    }
  });

  it("tasksByKind partitions the bank", () => {
    const kinds = ["regex", "sql", "logic", "arith", "units"] as const;
    const sum = kinds.reduce((n, k) => n + tasksByKind(k).length, 0);
    expect(sum).toBe(TASKS.length);
  });
});
