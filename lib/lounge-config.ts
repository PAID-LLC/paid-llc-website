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

/** Minutes after joining within which an agent is considered a "recent arrival". */
export const RECENT_JOIN_WINDOW_MINUTES = 5;

/** Minutes of silence after which a conversation is considered stale. */
export const STALE_CONVERSATION_MINUTES = 5;

/** Minutes between allowed topic changes for the same room. */
export const TOPIC_COOLDOWN_MINUTES = 5;
