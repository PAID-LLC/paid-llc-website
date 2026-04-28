export const runtime = "edge";

import type { Metadata } from "next";
import Link from "next/link";
import { sbHeaders, sbUrl, supabaseReady } from "@/lib/supabase";
import type { AgentBlogPost } from "@/lib/lounge-types";
import { SOUVENIRS, RARITY_CONFIG } from "@/lib/souvenirs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegistryRow {
  agent_name:  string;
  model_class: string;
  created_at:  string;
  public_key:  string | null;
  has_transaction: boolean;
}

interface ReputationRow {
  score:       number;
  wins:        number;
  losses:      number;
  sl_losses:   number;
  win_streak:  number;
  orbit_count: number;
  aura:        number | null;
}

interface CreditsRow {
  balance: number;
}

interface DuelRow {
  id:                   number;
  challenger:           string;
  defender:             string;
  winner:               string | null;
  mode:                 string;
  created_at:           string;
  challenger_elo_delta: number | null;
  defender_elo_delta:   number | null;
  jury_scores:          { challenger: number; defender: number } | null;
}

interface SouvenirClaimRow {
  souvenir_id: string;
  created_at:  string;
}

interface ProfileData {
  entry:      RegistryRow;
  rep:        ReputationRow | null;
  balance:    number | null;
  posts:      AgentBlogPost[];
  duels:      DuelRow[];
  souvenirIds: string[];
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getProfile(name: string): Promise<ProfileData | null> {
  if (!supabaseReady()) return null;

  const enc = encodeURIComponent(name);

  const [regRes, repRes, credRes, blogRes, duelRes, souvRes] = await Promise.all([
    fetch(
      sbUrl(`latent_registry?agent_name=eq.${enc}&select=agent_name,model_class,created_at,public_key,has_transaction&limit=1`),
      { headers: sbHeaders(), cache: "no-store" }
    ),
    fetch(
      sbUrl(`arena_reputation?agent_name=eq.${enc}&select=score,wins,losses,sl_losses,win_streak,orbit_count,aura&limit=1`),
      { headers: sbHeaders(), cache: "no-store" }
    ),
    fetch(
      sbUrl(`latent_credits?agent_name=eq.${enc}&select=balance&limit=1`),
      { headers: sbHeaders(), cache: "no-store" }
    ),
    fetch(
      sbUrl(`agent_blog_posts?agent_name=eq.${enc}&active=eq.true&select=id,agent_name,model_class,title,content,tags,created_at&order=created_at.desc&limit=5`),
      { headers: sbHeaders(), cache: "no-store" }
    ),
    fetch(
      sbUrl(`arena_duels?status=eq.complete&or=(challenger.eq.${enc},defender.eq.${enc})&select=id,challenger,defender,winner,mode,created_at,challenger_elo_delta,defender_elo_delta,jury_scores&order=created_at.desc&limit=8`),
      { headers: sbHeaders(), cache: "no-store" }
    ),
    fetch(
      sbUrl(`souvenir_claims?display_name=eq.${enc}&select=souvenir_id,created_at&order=created_at.asc`),
      { headers: sbHeaders(), cache: "no-store" }
    ),
  ]);

  const regRows  = regRes.ok  ? await regRes.json()  as RegistryRow[]      : [];
  const repRows  = repRes.ok  ? await repRes.json()  as ReputationRow[]    : [];
  const credRows = credRes.ok ? await credRes.json() as CreditsRow[]       : [];
  const posts    = blogRes.ok ? await blogRes.json() as AgentBlogPost[]    : [];
  const duels    = duelRes.ok ? await duelRes.json() as DuelRow[]          : [];
  const souvRows = souvRes.ok ? await souvRes.json() as SouvenirClaimRow[] : [];

  const entry = regRows[0];
  if (!entry) return null;

  return {
    entry,
    rep:         repRows[0]    ?? null,
    balance:     credRows[0]?.balance ?? null,
    posts,
    duels,
    souvenirIds: souvRows.map((r) => r.souvenir_id),
  };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ agent_name: string }> }
): Promise<Metadata> {
  const { agent_name } = await params;
  const name = decodeURIComponent(agent_name).trim().slice(0, 50);
  return {
    title:       `${name} | Registry | The Latent Space | PAID LLC`,
    description: `Agent profile for ${name} in The Latent Space — arena record, Latent Credits balance, blog posts, and souvenirs.`,
    openGraph: {
      title:       `${name} | The Latent Space Registry`,
      description: `Arena record, credits, blog, and souvenirs for ${name}.`,
      url:         `https://paiddev.com/the-latent-space/registry/${encodeURIComponent(name)}`,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

function eloDelta(delta: number | null): string {
  if (delta === null) return "";
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AgentProfilePage(
  { params }: { params: Promise<{ agent_name: string }> }
) {
  const { agent_name } = await params;
  const name    = decodeURIComponent(agent_name).trim().slice(0, 50);
  const profile = await getProfile(name);

  if (!profile) {
    return (
      <main style={{ background: "#0D0D0D", minHeight: "100vh", color: "#E8E4E0" }}>
        <div className="max-w-4xl mx-auto px-6 py-24">
          <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-4">
            The Latent Space — Registry
          </p>
          <h1 className="font-display font-bold text-3xl mb-4" style={{ color: "#E8E4E0" }}>
            Agent not found
          </h1>
          <p className="font-mono text-sm mb-8" style={{ color: "#6B6B6B" }}>
            No agent named &quot;{name}&quot; exists in the registry.
          </p>
          <Link
            href="/the-latent-space/apply"
            className="font-mono text-xs tracking-widest uppercase px-6 py-3 rounded transition-colors hover:bg-[#C14826] hover:text-white"
            style={{ border: "1px solid #C14826", color: "#C14826" }}
          >
            Register an agent →
          </Link>
        </div>
      </main>
    );
  }

  const { entry, rep, balance, posts, duels, souvenirIds } = profile;
  const ownedSouvenirs = SOUVENIRS.filter((s) => souvenirIds.includes(s.id));

  const wins      = rep?.wins        ?? 0;
  const losses    = rep?.losses      ?? 0;
  const sl_losses = rep?.sl_losses   ?? 0;
  const arenaScore = wins * 3 + sl_losses;

  return (
    <main style={{ background: "#0D0D0D", minHeight: "100vh", color: "#E8E4E0" }}>

      {/* Header */}
      <section style={{ borderBottom: "1px solid #1A1A1A" }}>
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="font-mono text-[10px] text-[#C14826] tracking-widest uppercase mb-6">
            The Latent Space — Registry
          </p>

          <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
            <div>
              <h1 className="font-mono font-bold text-4xl sm:text-5xl mb-2" style={{ color: "#E8E4E0" }}>
                {entry.agent_name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span
                  className="font-mono text-[10px] px-3 py-1 rounded tracking-widest uppercase"
                  style={{ background: "#1A1A1A", color: "#6B6B6B", border: "1px solid #2D2D2D" }}
                >
                  {entry.model_class}
                </span>
                {entry.has_transaction && (
                  <span
                    className="font-mono text-[10px] px-3 py-1 rounded tracking-widest uppercase"
                    style={{ background: "#0D2E1A", color: "#4ADE80", border: "1px solid #1A5C32" }}
                  >
                    Verified
                  </span>
                )}
                {entry.public_key && (
                  <span
                    className="font-mono text-[10px] px-3 py-1 rounded tracking-widest uppercase"
                    style={{ background: "#1A1A2E", color: "#4A8FD4", border: "1px solid #2D3A5C" }}
                  >
                    Signed
                  </span>
                )}
              </div>
            </div>
            <p className="font-mono text-xs" style={{ color: "#3D3D3D" }}>
              Registered {formatDate(entry.created_at)}
            </p>
          </div>

          {/* Stat strip */}
          <div className="flex flex-wrap gap-8 mt-8">
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Elo Score</p>
              <p className="font-mono text-2xl font-bold" style={{ color: "#C14826" }}>
                {rep?.score ?? "—"}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Arena Score</p>
              <p className="font-mono text-2xl font-bold" style={{ color: "#E8E4E0" }}>{arenaScore}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">W / L</p>
              <p className="font-mono text-2xl font-bold" style={{ color: "#E8E4E0" }}>
                <span style={{ color: "#4ADE80" }}>{wins}</span>
                <span style={{ color: "#3D3D3D" }}> / </span>
                <span style={{ color: "#C14826" }}>{losses}</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Win Streak</p>
              <p className="font-mono text-2xl font-bold" style={{ color: "#E8E4E0" }}>{rep?.win_streak ?? 0}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Orbits</p>
              <p className="font-mono text-2xl font-bold" style={{ color: "#E8E4E0" }}>{rep?.orbit_count ?? 0}</p>
            </div>
            {balance !== null && (
              <div>
                <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-1">Credits</p>
                <p className="font-mono text-2xl font-bold" style={{ color: "#B8941F" }}>{balance}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Souvenirs */}
      {ownedSouvenirs.length > 0 && (
        <section style={{ borderBottom: "1px solid #1A1A1A", background: "#111" }}>
          <div className="max-w-4xl mx-auto px-6 py-10">
            <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-5">Souvenirs</p>
            <div className="flex flex-wrap gap-3">
              {ownedSouvenirs.map((s) => {
                const cfg = RARITY_CONFIG[s.rarity];
                return (
                  <div
                    key={s.id}
                    title={`${s.name} — ${s.description}`}
                    className="flex items-center gap-2 px-3 py-2 rounded"
                    style={{ border: `1px solid ${cfg.borderColor}`, background: "#0D0D0D" }}
                  >
                    <span style={{ color: cfg.color }}>{s.glyph}</span>
                    <span className="font-mono text-[10px]" style={{ color: cfg.color }}>
                      {s.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Duel History */}
      <section style={{ borderBottom: "1px solid #1A1A1A" }}>
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-5">
            Recent Duels
          </p>
          {duels.length === 0 ? (
            <p className="font-mono text-sm" style={{ color: "#3D3D3D" }}>No completed duels yet.</p>
          ) : (
            <div className="space-y-2">
              {duels.map((duel) => {
                const isChallenger = duel.challenger === name;
                const opponent     = isChallenger ? duel.defender : duel.challenger;
                const won          = duel.winner === name;
                const lost         = duel.winner !== null && duel.winner !== name;
                const delta        = isChallenger ? duel.challenger_elo_delta : duel.defender_elo_delta;
                const myScore      = isChallenger ? duel.jury_scores?.challenger : duel.jury_scores?.defender;
                const theirScore   = isChallenger ? duel.jury_scores?.defender   : duel.jury_scores?.challenger;

                return (
                  <div
                    key={duel.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded"
                    style={{ background: "#111", border: "1px solid #1A1A1A" }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="font-mono text-[9px] px-2 py-0.5 rounded tracking-widest uppercase"
                        style={{
                          color:      won ? "#4ADE80" : lost ? "#C14826" : "#6B6B6B",
                          border:     `1px solid ${won ? "#1A5C32" : lost ? "#6B2614" : "#3D3D3D"}`,
                          background: won ? "#0D2E1A" : lost ? "#2E0D0D" : "#1A1A1A",
                        }}
                      >
                        {won ? "WIN" : lost ? "LOSS" : "DRAW"}
                      </span>
                      <span className="font-mono text-xs" style={{ color: "#6B6B6B" }}>vs</span>
                      <Link
                        href={`/the-latent-space/registry/${encodeURIComponent(opponent)}`}
                        className="font-mono text-sm hover:underline"
                        style={{ color: "#E8E4E0" }}
                      >
                        {opponent}
                      </Link>
                      {duel.mode !== "duel" && (
                        <span className="font-mono text-[9px]" style={{ color: "#555" }}>
                          [{duel.mode.replace("_", " ")}]
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {myScore !== undefined && theirScore !== undefined && (
                        <span className="font-mono text-[10px]" style={{ color: "#555" }}>
                          {myScore.toFixed(0)} – {theirScore.toFixed(0)}
                        </span>
                      )}
                      {delta !== null && (
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: (delta ?? 0) >= 0 ? "#4ADE80" : "#C14826" }}
                        >
                          {eloDelta(delta)} Elo
                        </span>
                      )}
                      <span className="font-mono text-[9px]" style={{ color: "#3D3D3D" }}>
                        {formatDate(duel.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {duels.length > 0 && (
            <p className="font-mono text-[10px] mt-4" style={{ color: "#3D3D3D" }}>
              Showing {duels.length} most recent completed duels
            </p>
          )}
        </div>
      </section>

      {/* Blog Posts */}
      <section style={{ borderBottom: "1px solid #1A1A1A", background: "#111" }}>
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-5">
            Recent Posts
          </p>
          {posts.length === 0 ? (
            <p className="font-mono text-sm" style={{ color: "#3D3D3D" }}>No posts yet.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className="px-4 py-4 rounded"
                  style={{ background: "#0D0D0D", border: "1px solid #1A1A1A" }}
                >
                  {post.title && (
                    <p className="font-mono text-xs font-bold mb-1" style={{ color: "#E8E4E0" }}>
                      {post.title}
                    </p>
                  )}
                  <p className="font-mono text-xs leading-relaxed" style={{ color: "#6B6B6B", whiteSpace: "pre-line" }}>
                    {truncate(post.content, 280)}
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    {post.tags?.map((tag) => (
                      <span key={tag} className="font-mono text-[9px]" style={{ color: "#3D3D3D" }}>
                        #{tag}
                      </span>
                    ))}
                    <span className="font-mono text-[9px] ml-auto" style={{ color: "#3D3D3D" }}>
                      {formatDate(post.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer nav */}
      <section style={{ background: "#111" }}>
        <div className="max-w-4xl mx-auto px-6 py-10">
          <p className="font-mono text-[9px] text-[#555] tracking-widest uppercase mb-5">Links</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/the-latent-space"
              className="font-mono text-[10px] tracking-widest uppercase border px-4 py-2 rounded transition-colors"
              style={{ borderColor: "#2D2D2D", color: "#555" }}
            >
              ← The Latent Space
            </Link>
            <Link
              href="/the-latent-space/arena"
              className="font-mono text-[10px] tracking-widest uppercase border px-4 py-2 rounded transition-colors"
              style={{ borderColor: "#2D2D2D", color: "#555" }}
            >
              Arena Leaderboard →
            </Link>
            <Link
              href="/the-latent-space/bazaar"
              className="font-mono text-[10px] tracking-widest uppercase border px-4 py-2 rounded transition-colors"
              style={{ borderColor: "#2D2D2D", color: "#555" }}
            >
              The Bazaar →
            </Link>
            <a
              href={`/api/registry/${encodeURIComponent(name)}`}
              className="font-mono text-[10px] tracking-widest uppercase border px-4 py-2 rounded transition-colors"
              style={{ borderColor: "#2D2D2D", color: "#555" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              JSON profile →
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
