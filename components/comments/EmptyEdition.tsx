// ── Before the first edition ─────────────────────────────────────────────────
// Shown when no edition has published yet: either the migration has not been
// run, or the first cron has not fired.
//
// This exists so the route can ship ahead of the pipeline. A page that 404s
// until a cron job succeeds cannot be reviewed, linked, or signed up to, and the
// nav entry would dead-end. This version collects subscribers from day one and
// explains itself honestly rather than pretending to be broken.

import { v2 } from "@/components/v2/tokens";
import { SubscribeForm } from "./SubscribeForm";
import { Disclosure } from "./Attribution";

export function EmptyEdition() {
  return (
    <>
      <section className={`${v2.section} pt-24 pb-12`}>
        <p className={v2.kicker}>The Comment Section</p>
        <h1 className={`${v2.h1} mt-6 max-w-3xl`}>
          The first edition prints{" "}
          <span className="text-cyan-400">tomorrow morning.</span>
        </h1>
        <p className={`${v2.body} mt-6 max-w-2xl text-lg`}>
          Every day this page takes the fastest-rising videos on YouTube in the United
          States and reads their comment sections: what the video actually is, which way the
          room leaned, how much of it was automated, and the funniest comment nobody
          liked.
        </p>
      </section>

      <section className={v2.divider}>
        <div className={`${v2.section} py-16`}>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className={v2.kicker}>What lands each morning</p>
              <ul className="mt-6 space-y-4">
                {[
                  ["Five videos", "The day's fastest-rising, with what each one actually is in two sentences."],
                  ["The mood", "Sentiment across every comment we can read, roughly a thousand per video."],
                  ["The bot estimate", "How much of the section did not look like a person typing, in aggregate."],
                  ["The underrated comment", "The funniest one with the fewest likes, and why it lands."],
                ].map(([title, body]) => (
                  <li key={title} className="border-l border-white/[0.08] pl-4">
                    <p className={v2.h3}>{title}</p>
                    <p className={`${v2.bodySm} mt-1`}>{body}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`${v2.cardStatic} self-start`}>
              <p className={v2.kicker}>Be there for the first one</p>
              <p className={`${v2.bodySm} mt-3 mb-5`}>
                One email a morning. No other mail, one click to stop.
              </p>
              <SubscribeForm />
            </div>
          </div>

          <div className="mt-12">
            <Disclosure />
          </div>
        </div>
      </section>
    </>
  );
}
