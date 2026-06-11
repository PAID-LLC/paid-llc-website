import Link from "next/link";
import { v2 } from "@/components/v2/tokens";

// Placeholder for v2 routes whose build phase has not landed yet.
// Keeps nav links live on the staging domain instead of 404ing.
export default function PhaseStub({
  phase,
  title,
  body,
}: {
  phase: string;
  title: string;
  body: string;
}) {
  return (
    <section className={`${v2.section} py-32 text-center`}>
      <span className={v2.chip}>{phase}</span>
      <h1 className={`${v2.h2} mt-6`}>{title}</h1>
      <p className={`${v2.body} mx-auto mt-4 max-w-xl`}>{body}</p>
      <div className="mt-10">
        <Link href="/v2" className={v2.btnGhost}>
          &larr; Back to overview
        </Link>
      </div>
    </section>
  );
}
