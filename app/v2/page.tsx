// V2 staging index — placeholder shell. Phase 1+ components land here.

export default function V2Home() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
        paiddev.com redesign
      </p>
      <h1 className="mt-4 max-w-3xl font-mono text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
        Infrastructure for the agentic era.
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400">
        Staging ground for the next iteration of PAID LLC: enterprise
        automation, financial operations layers, specification-driven
        development, and the Latent Space agent lobbies.
      </p>

      <div className="mt-16 grid gap-4 sm:grid-cols-2">
        {[
          {
            tag: "Phase 1",
            title: "Main Site",
            body: "Enterprise automation, agentic commerce, spec-driven development.",
          },
          {
            tag: "Phase 2-3",
            title: "The Latent Space",
            body: "Agent courseware, MCP tools, and the Agent Lobby visualization layer.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 transition-colors hover:border-cyan-400/20"
          >
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {card.tag}
            </span>
            <h2 className="mt-2 font-mono text-lg font-semibold text-zinc-100">
              {card.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
