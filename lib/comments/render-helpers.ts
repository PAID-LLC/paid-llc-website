// ── Formatting and SVG geometry ──────────────────────────────────────────────
// Pure functions the components use so the JSX stays declarative and the maths
// stays testable. No React, no imports.
//
// The SVG helpers are here rather than in a chart library on purpose: the
// Cloudflare Worker bundle sits near its 10 MiB cap, and four small charts do
// not justify a dependency. ringArcs and sparklinePath are the only real
// geometry in the whole feature.

const SITE = "https://paiddev.com";

/** 4,812 -> "4.8k". Whole numbers below 1,000 stay exact. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, "") : Math.round(k)}k`;
  }
  const m = n / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, "") : Math.round(m)}M`;
}

/** 0.62 -> "62%". */
export function pct(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "0%";
  return `${(n * 100).toFixed(digits)}%`;
}

/** "2026-09-14" -> "Monday, September 14, 2026". Date-only, no timezone shift. */
export function formatEditionDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-09-14" -> "Sep 14". For dense archive chips. */
export function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "3 days ago". Coarse on purpose; exact timestamps are noise on a card. */
export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 90) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th", 11 -> "11th".
 * The teens are the whole reason this is not `n + "th"`: 11, 12 and 13 take
 * "th" despite ending in 1, 2 and 3.
 */
export function ordinal(n: number): string {
  if (!Number.isFinite(n)) return "0th";
  const abs = Math.abs(Math.round(n));
  const lastTwo = abs % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${abs}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[abs % 10] ?? "th";
  return `${abs}${suffix}`;
}

/** "1,240 seconds" -> "20:40". */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

// ── Links ────────────────────────────────────────────────────────────────────
// Every one of these is required by YouTube's terms, not decoration: displayed
// data has to link back to its source.

export function youtubeWatchUrl(videoId: string, commentId?: string | null): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return commentId ? `${base}&lc=${commentId}` : base;
}

export function youtubeChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

export function editionPath(date: string): string {
  return `/comments/${date}`;
}

export function videoPath(videoId: string): string {
  return `/comments/v/${videoId}`;
}

export function absoluteUrl(path: string): string {
  return `${SITE}${path}`;
}

// ── Validation ───────────────────────────────────────────────────────────────

export function isValidEditionDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Round-trips only for a real calendar date, so 2026-02-31 is rejected.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidVideoId(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z0-9_-]{11}$/.test(s);
}

// ── SVG geometry ─────────────────────────────────────────────────────────────

export interface RingArc {
  key: string;
  /** Length of this arc along the circumference. */
  dash: number;
  /** Distance from the start of the circle to this arc's start. */
  offset: number;
}

/**
 * Three arcs of a donut, as stroke-dasharray/offset pairs.
 *
 * Returns lengths along the circumference rather than degrees, because that is
 * what SVG strokes take directly. Callers pass the circumference; the arcs sum
 * to it exactly (the last one absorbs rounding) so there is never a hairline gap.
 */
export function ringArcs(
  shares: { positive: number; neutral: number; negative: number },
  circumference: number
): RingArc[] {
  const total = shares.positive + shares.neutral + shares.negative;
  if (total <= 0) {
    return [{ key: "neutral", dash: circumference, offset: 0 }];
  }

  const order: [string, number][] = [
    ["positive", shares.positive / total],
    ["neutral", shares.neutral / total],
    ["negative", shares.negative / total],
  ];

  const arcs: RingArc[] = [];
  let consumed = 0;
  order.forEach(([key, share], i) => {
    const isLast = i === order.length - 1;
    const dash = isLast ? circumference - consumed : share * circumference;
    arcs.push({ key, dash, offset: -consumed });
    consumed += dash;
  });

  return arcs.filter((a) => a.dash > 0.01);
}

/**
 * A sparkline path and its matching filled area.
 * Scaled to the maximum value, so the shape shows the distribution rather than
 * the absolute volume; the card states the volume separately in numerals.
 */
export function sparklinePath(
  values: number[],
  width: number,
  height: number
): { line: string; area: string; peakIndex: number; peakX: number; peakY: number } {
  if (values.length === 0) {
    return { line: "", area: "", peakIndex: 0, peakX: 0, peakY: height };
  }

  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)},${round(p.y)}`).join(" ");
  const area = `${line} L${round(width)},${round(height)} L0,${round(height)} Z`;

  let peakIndex = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[peakIndex]) peakIndex = i;

  return {
    line,
    area,
    peakIndex,
    peakX: round(points[peakIndex].x),
    peakY: round(points[peakIndex].y),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Truncates on a word boundary and appends an ellipsis. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Escapes the five XML entities, for the RSS and sitemap routes. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
