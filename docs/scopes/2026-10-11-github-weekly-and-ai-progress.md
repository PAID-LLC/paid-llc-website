# Scope: two new pages for paiddev.com

*Written 2026-10-11. This is a scope, not a build. Nothing here is implemented yet.*

| | **A. GitHub Weekly** | **B. AI Progress** |
|---|---|---|
| Proposed URL | `/github-weekly` (archive at `/github-weekly/YYYY-MM-DD`) | `/ai-progress` |
| What it is | The 5 GitHub repos that gained the most attention this week, each with a plain-English "why it matters" | One long, well-organized reference page charting how far AI has come since GPT-3 (May 2020), with sources on every number |
| Shape | Recurring, automated, weekly edition | Mostly static reference, updated by hand each quarter |
| Hardest part | Defining "top" honestly (star *growth*, not star *count*) | The research: a few hundred dated, sourced data points |
| Client JS | None | One small island (timeline filter); charts are server-rendered SVG |
| Rough size | 3 to 4 sessions | 1 to 2 sessions of research, then 3 to 4 sessions of build |

Both pages follow patterns already in the repo: The Comment Section (`/comments`) for the weekly automated edition, and the blog plus `/trust` for long reference pages. Neither adds a dependency or a three.js surface, so neither threatens the 10 MiB Worker cap.

---

## A. GitHub Weekly: top 5 repos of the week

### The core decision: what "top" means

GitHub has no public trending API. The options:

| Method | What it measures | Verdict |
|---|---|---|
| Scrape github.com/trending | GitHub's own trending list | **No.** HTML scraping, breaks without warning, terms-of-service grey area, and the result is what everyone else already reposts |
| Search API, `created:>7d sort:stars` | Newest repos with the most stars | Misses established repos that blew up this week. Useful as a *candidate source* only |
| **Star delta from our own snapshots** | Stars *gained* in the last 7 days | **Recommended.** Honest, reproducible, and it is our own data, which nobody else's weekly list has |
| OSS Insight public API | Third-party trending computed from GH Archive | Good cross-check and a fallback while our snapshots warm up |

**Recommendation:** rank by stars gained over 7 days, measured from our own daily snapshots of a candidate pool. The first edition can ship after 7 days of snapshots; until then OSS Insight backfills.

### Pipeline (mirrors The Comment Section)

1. **Daily snapshot** (`/api/github-weekly/cron?step=snapshot`): build the candidate pool from the Search API (repos created in the last 90 days with 50+ stars, repos pushed this week with 1k+ stars, plus OSS Insight's trending list), then record `stargazers_count` for each. About 300 to 500 repos a day, roughly 10 API calls with GraphQL batching, well under the 5,000/hour authenticated limit.
2. **Weekly pick** (Monday, `step=pick`): rank by 7-day delta, apply filters (below), take the top 5.
3. **Write-up** (`step=write`, one request per repo, resumable claim like `lib/comments/store.ts`): read the README and recent release notes, then have Claude write a 2 to 3 sentence "what it is", one line on "who it's for", and one on "why this week". Run it through the existing `readsHuman` voice check in `lib/comments/voice.ts`.
4. **Publish** (`step=publish`): mark the edition live.

Trigger: GitHub Actions with the same redundant-schedule pattern as `.github/workflows/comment-section.yml`, since that workflow's header documents GitHub dropping or delaying scheduled runs.

### Filters (to decide once, then encode)

- Exclude: archived repos, forks, repos under 7 days old with no README, star-farm signatures (big star jump, near-zero forks/issues/watchers)
- **Decision needed:** exclude "awesome-lists" and pure link collections? Recommend yes; they trend constantly and teach nothing.
- **Decision needed:** all of GitHub, or AI/agent repos only? Recommend **all of GitHub with an "AI" badge**. It is broader and less predictable, and the badge still serves the site's audience. AI-only is a one-line filter if you prefer it.

### Data (Supabase, service key only, deny-all RLS like every table)

- `gh_star_snapshots (repo_id, full_name, stars, forks, captured_on)`, pruned after 60 days
- `gh_weekly_editions (week_of, status, published_at)`
- `gh_weekly_repos (week_of, rank, repo_id, full_name, description, language, stars, stars_gained, writeup jsonb, is_ai)`

### Page

- Server-rendered with zero client JS: five cards (rank, name, stars gained this week, total stars, language, write-up, link out)
- Archive list at `/github-weekly/archive`
- JSON-LD `ItemList` of `SoftwareSourceCode`; sitemap entries; per-edition og:image (see the og:image gap in the 2026-10-11 site test)
- Markdown rendition for agents: add to `MD_NEGOTIABLE` in `middleware.ts` and `app/api/md`
- Optional: append to the existing newsletter or comments subscribe flow
- One primary CTA. Suggest "Get It Every Monday" (subscribe).

### Secrets and cost

- `GITHUB_TOKEN` (fine-grained, public-repo read only) as a Pages secret
- Claude API: 5 short write-ups a week, cents per week. Use the same model the comments pipeline uses.

---

## B. AI Progress: everything since GPT-3

### Why organization is the whole job

The material is enormous, and a chronological wall of launches is what every other "AI timeline" page is. This page organizes by **what changed**, with time as the x-axis everywhere:

### Page structure (sticky table of contents, one chapter per question)

0. **The one-screen summary.** A single hero chart (METR task-length horizon, below) plus five headline numbers: then (2020) vs now.
1. **How capable did it get?** Benchmarks over time, one small chart each, with a short note when a benchmark saturated and the field moved on:
   - MMLU (saturated around 2024), GPQA Diamond, SWE-bench Verified, HumanEval (saturated), ARC-AGI 1 and 2, Humanity's Last Exam, FrontierMath
   - Every point labeled *lab-reported* or *independently measured*. They are not the same thing, and mixing them silently is the most common error on pages like this.
2. **How long a task can it do alone?** METR's time-horizon measure (length of task a model completes at 50% success, doubling roughly every 7 months). This is the best single chart of progress; it is the hero.
3. **How much cheaper did it get?** Price per million tokens to reach a fixed capability level (GPT-3.5-level, GPT-4-level) over time. A drop of roughly 100x to 1,000x is the story small businesses care about most.
4. **How much can it read at once?** Context window: 2,048 tokens (GPT-3) to 1M+.
5. **What can it see, hear, and make?** Modality timeline: text, then images (DALL-E, GPT-4V), speech (Whisper, real-time voice), video (Sora, Veo), computer use.
6. **When did it start reasoning and acting?** Chain-of-thought, reasoning models (o1, Sept 2024), tool use, computer use (Oct 2024), coding agents, MCP, agentic commerce.
7. **Open vs closed.** The gap between the best open-weights model and the frontier over time (LLaMA, Mistral, Qwen, DeepSeek R1).
8. **How big did training get?** Training compute (Epoch AI data, log scale) and the hardware behind it.
9. **Who actually uses it?** Adoption: ChatGPT reaching 100M users in about 2 months, business adoption surveys.
10. **The full timeline.** Every milestone, filterable by category and lab. This is the only client-side island.
11. **Methodology and sources.** What was counted, what wasn't, and a "last updated" date.

Each chapter opens with one plain-English sentence on what it means for a business owner. That is the angle no research-lab page takes, and it is the site's audience.

### The research phase (do this first, as its own session)

Output: a typed dataset in `content/ai-progress/`, not prose.

- `milestones.ts`: `{ date, title, lab, category[], significance: 1-3, summary, sourceUrl }`, about 120 to 200 entries, May 2020 to present
- `benchmarks.ts`: `{ benchmark, model, lab, date, score, measuredBy: "lab" | "independent", sourceUrl }`
- `prices.ts`, `context.ts`, `compute.ts`, `adoption.ts`: same shape, one series each

Rules for the dataset:
- Every number has a source URL and an access date. No source, no data point.
- Prefer primary sources (papers, lab announcements, model cards) and established trackers: Epoch AI (CC-BY, credit them), METR, Stanford AI Index, Artificial Analysis, LMArena, ARC Prize, SWE-bench leaderboard. Papers with Code shut down in 2025 and should not be cited.
- Anything after mid-2026 needs fresh web research; do not fill it from memory.
- Tests: a vitest file that asserts every entry has a source URL, dates parse, and series are sorted. That turns "sourced on every number" from a promise into a check.

### Build

- **Charts:** hand-rolled server-rendered SVG components (`<LineChart>`, `<StepTimeline>`, `<LogScaleChart>`) in brand colors. No chart library: Recharts or Chart.js would add client JS to a page that doesn't need it, against a Worker already near its cap.
- Accessible: every chart has a caption, a `<table>` fallback, and the data downloadable as CSV (also good for agents and for backlinks).
- Long page performance: chapters below the fold are plain HTML; the timeline filter island is lazy-hydrated.
- SEO: Article plus Dataset JSON-LD, its own og:image (a rendered version of the hero chart), sitemap entry, markdown rendition, link from the blog's "AI Trends" category and the existing `ai-progress-government-june-2026` post.
- One primary CTA. Suggest "Start a Project", framed as "put this progress to work in your business".

### Maintenance

Quarterly refresh: add the quarter's milestones and benchmark points, bump "last updated". Could become a blog post each quarter ("What changed in AI this quarter") that links back to the page.

---

## Suggested order

1. **AI Progress research session** (data only, with source tests). Biggest unknown; start it first.
2. **GitHub Weekly snapshot cron**, shipped alone so 7 days of star history accumulate while other work happens.
3. **AI Progress page build** on top of the dataset.
4. **GitHub Weekly pick, write-up, page**, first edition the following Monday.

## Decisions needed from you

1. GitHub Weekly: all of GitHub with an AI badge (recommended) or AI-only?
2. GitHub Weekly: exclude awesome-lists? (Recommended: yes)
3. URLs: `/github-weekly` and `/ai-progress` OK?
4. Nav placement: top nav, footer, or blog-only links to start?
5. AI Progress voice: neutral reference (recommended), or with Travis's commentary per chapter like the blog?
