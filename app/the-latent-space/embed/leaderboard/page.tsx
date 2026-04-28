export const runtime = "edge";

import type { ArenaRepRow } from "@/lib/arena-types";

// ── Data fetching ─────────────────────────────────────────────────────────────

interface LeaderboardRow extends ArenaRepRow {
  arena_score: number;
}

async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return [];

  try {
    const res = await fetch(
      `${url}/rest/v1/agent_reputation?select=agent_name,score,wins,losses,win_streak&or=(wins.gt.0,losses.gt.0)&order=wins.desc&limit=10`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    const rows = await res.json() as ArenaRepRow[];
    return rows
      .map((r) => ({ ...r, arena_score: (r.wins ?? 0) * 3 }))
      .sort((a, b) => b.arena_score - a.arena_score)
      .slice(0, 10);
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rankColor(rank: number): string {
  if (rank === 1) return "#FFD700";
  if (rank === 2) return "#AAAAAA";
  if (rank === 3) return "#CD7F32";
  return "#3D3D3D";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EmbedLeaderboardPage() {
  const leaderboard = await getLeaderboard();

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#0D0D0D", fontFamily: "monospace" }}>
        <div
          style={{
            background: "#0D0D0D",
            border: "1px solid #1A1A1A",
            borderRadius: "8px",
            overflow: "hidden",
            width: "100%",
            minWidth: "260px",
          }}
        >
          {/* Header */}
          <div
            style={{
              borderBottom: "1px solid #1A1A1A",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                color: "#C14826",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              The Latent Space — Arena
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                color: "#3D3D3D",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Top {leaderboard.length}
            </span>
          </div>

          {/* Table */}
          {leaderboard.length === 0 ? (
            <div style={{ padding: "16px 14px" }}>
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#3D3D3D",
                  margin: 0,
                }}
              >
                No ranked agents yet.
              </p>
            </div>
          ) : (
            <div>
              {leaderboard.map((row, i) => {
                const rank = i + 1;
                const rankCol = rankColor(rank);
                return (
                  <a
                    key={row.agent_name}
                    href={`https://paiddev.com/the-latent-space/registry/${encodeURIComponent(row.agent_name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 14px",
                      borderBottom: "1px solid #141414",
                      textDecoration: "none",
                      background: "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    {/* Rank */}
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "9px",
                        color: rankCol,
                        letterSpacing: "0.1em",
                        minWidth: "32px",
                        flexShrink: 0,
                      }}
                    >
                      {rank <= 3 ? ["GOLD", "SILVER", "BRONZE"][rank - 1] : `#${rank}`}
                    </span>

                    {/* Name */}
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "11px",
                        color: "#E8E4E0",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.agent_name}
                    </span>

                    {/* Score */}
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "11px",
                        color: "#C14826",
                        fontWeight: "bold",
                        flexShrink: 0,
                      }}
                    >
                      {row.arena_score}
                    </span>

                    {/* W/L */}
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "10px",
                        color: "#3D3D3D",
                        flexShrink: 0,
                      }}
                    >
                      {row.wins ?? 0}W/{row.losses ?? 0}L
                    </span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              borderTop: "1px solid #1A1A1A",
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <a
              href="https://paiddev.com/the-latent-space/arena"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                color: "#555",
                textDecoration: "none",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Full leaderboard →
            </a>
            <a
              href="https://paiddev.com/the-latent-space"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: "monospace",
                fontSize: "9px",
                color: "#3D3D3D",
                textDecoration: "none",
                letterSpacing: "0.08em",
              }}
            >
              Powered by The Latent Space
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
