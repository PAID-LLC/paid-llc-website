export const runtime = "edge";

// ── /comments/about ──────────────────────────────────────────────────────────
// The methodology page, linked from every disclosure line on the site.
//
// It has two audiences and serves both with the same text. A reader who wonders
// whether "14% automated" means anything gets an honest answer including the
// limits. A YouTube API compliance reviewer gets, in one place, the retention
// policy, the attribution practice, the derived-metrics disclosure, and the
// statement of non-affiliation. If this feature is ever audited, this is the URL
// to hand over.

import type { Metadata } from "next";
import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

export const metadata: Metadata = {
  title: "How The Comment Section works | paiddev.com",
  description:
    "What we compute, how we compute it, what we store and for how long, and what these numbers do not mean.",
  alternates: { canonical: "https://paiddev.com/comments/about" },
};

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className={v2.divider}>
      <div className={`${v2.section} py-14`}>
        <p className={v2.kicker}>{kicker}</p>
        <h2 className={`${v2.h2} mt-4 max-w-3xl !text-2xl sm:!text-3xl`}>{title}</h2>
        <div className="mt-6 max-w-3xl space-y-4">{children}</div>
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <>
      <section className={`${v2.section} pt-20 pb-10`}>
        <p className={v2.kicker}>Method</p>
        <h1 className={`${v2.h1} mt-6 max-w-3xl !text-3xl sm:!text-5xl`}>
          How this page is <span className="text-cyan-400">built</span>.
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          Every morning an automated pipeline reads the day&apos;s most-watched public
          videos and their comment sections. Nobody edits the result by hand. Here is
          exactly what it does, what it keeps, and what its numbers are worth.
        </p>
      </section>

      <Section kicker="Selection" title="How the five videos are chosen">
        <p className={v2.body}>
          We read the top 25 of YouTube&apos;s most-popular chart for the United States
          and take the first five that pass a fixed filter. A video is skipped if it
          is a live broadcast, if comments are turned off, if it has fewer than 200
          comments, if it is under a minute, if its language is set to anything other
          than English, or if it has already had its day here.
        </p>
        <p className={v2.body}>
          Nothing is chosen editorially and nothing is chosen for how it will read.
          When fewer than five survive, the edition runs short and says so.
        </p>
      </Section>

      <Section kicker="Analysis" title="What is computed, and by what">
        <p className={v2.body}>
          For each video we fetch up to a thousand top-level comments. Sentiment,
          recurring themes, emoji counts, comment timing, and the automation estimate
          are all computed in ordinary code on our own servers, not by a language
          model. That is a deliberate choice: it is free, it is fast, and it gives
          the same answer twice for the same input.
        </p>
        <p className={v2.body}>
          A model is used for exactly two things per video, because neither is
          possible in code. It watches the first twelve minutes of the video to say
          what the video is. And it picks the funniest comment from a shortlist of
          about 25 that code has already narrowed down by likes, length, and
          cleanliness. Everything else it is shown is a summary of numbers we
          computed first.
        </p>
      </Section>

      <Section kicker="Sentiment" title="What the mood figure does and does not mean">
        <p className={v2.body}>
          Sentiment is scored with a weighted word list written for comment sections
          specifically, including slang a general-purpose list gets backwards:
          &ldquo;sick&rdquo;, &ldquo;insane&rdquo; and &ldquo;goat&rdquo; are praise here,
          &ldquo;mid&rdquo; and &ldquo;cooked&rdquo; are not. Negation flips a score,
          intensifiers scale it, shouting amplifies it, and emoji count.
        </p>
        <p className={v2.body}>
          It cannot detect sarcasm. It only reads English. On a single comment it is
          noisy and sometimes simply wrong. Across a thousand comments the direction
          is meaningful, which is the only level the page reports it at.
        </p>
      </Section>

      <Section kicker="Automation" title="What the bot estimate is, and the line we will not cross">
        <p className={v2.body}>
          The automation figure is an estimate of how much of a comment section did
          not look like a person typing. It weighs observable signals: identical text
          posted by several different accounts, known scam and engagement-farm
          phrasing, links and phone numbers, hidden characters used to dodge filters,
          very new accounts, accounts with no uploads, and comments posted within
          minutes of upload. No single signal is enough on its own, because plenty of
          real people have new accounts and auto-assigned handles.
        </p>
        <p className={v2.body}>
          <strong className="text-zinc-200">We never label a named account a bot.</strong>{" "}
          Calling a specific person automated is a factual claim about a human being,
          made by a heuristic with no way to verify it. So per-comment scores are
          never stored, never published, and never attached to a name. Only the
          aggregate is reported, and any comment that scores as possibly automated is
          excluded from being quoted at all.
        </p>
      </Section>

      <Section kicker="Data" title="What we store, and for how long">
        <p className={v2.body}>
          Comments are analysed in memory and thrown away. What we keep is our own
          analysis, which contains no comment text and no author names, plus at most
          six featured comments per video, held so the page can quote them.
        </p>
        <p className={v2.body}>
          YouTube&apos;s API terms require stored data to be refreshed or deleted within
          30 days. Every day the pipeline re-checks any stored comment or statistic
          older than 25 days against YouTube. If a comment has been deleted there, its
          text is deleted here and the page says so in its place. Our own commentary
          about it stays, because that part is ours.
        </p>
      </Section>

      <Section kicker="Attribution" title="Where the material comes from">
        <p className={v2.body}>
          Video titles, thumbnails, statistics and comment text come from the YouTube
          Data API and belong to their creators and authors. Every comment and video
          on this site links back to its original. Sentiment, themes and automation
          figures are PAID LLC&apos;s own estimates and are not YouTube metrics.
        </p>
        <p className={v2.body}>
          PAID LLC is not affiliated with or endorsed by YouTube or Google.
        </p>
      </Section>

      <Section kicker="Corrections" title="If something here is wrong">
        <p className={v2.body}>
          If your comment is quoted and you would rather it were not, or if something
          on this page is inaccurate, write to us and it will be removed or corrected.
          Deleting the comment on YouTube also removes it here within a day.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/contact" className={v2.btnPrimary}>
            Get in touch
          </Link>
          <Link href="/comments" className={v2.btnSecondary}>
            Read today&apos;s edition
          </Link>
        </div>
      </Section>
    </>
  );
}
