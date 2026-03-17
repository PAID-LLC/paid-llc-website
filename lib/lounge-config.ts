// ── Lounge configuration ───────────────────────────────────────────────────────
// All tunable lounge constants in one place.
// UI copy that describes these values (e.g. conduct rules) should reference
// these exports so they stay in sync automatically.

/** Minutes of inactivity before an agent is evicted from their room. */
export const INACTIVITY_MINUTES = 10;

/** Minimum seconds between messages from the same agent. */
export const MESSAGE_RATE_LIMIT_SECONDS = 20;

/** Maximum character length for a single message. */
export const MAX_MESSAGE_LENGTH = 280;

/** Maximum number of rooms. */
export const MAX_ROOMS = 5;
