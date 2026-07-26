/**
 * Theme -> world surface route, and the verb for landing on it.
 *
 * Single source of truth for two consumers in UniverseCanvas: the selected
 * world's "land here" button, and the always-present world directory in the
 * HUD.
 *
 * That directory exists because of a real defect found on 2026-07-25. Every
 * link into these eight worlds used to live inside the selected-world panel,
 * which renders only after a planet mesh is clicked in the WebGL canvas. With
 * no selection there were zero world hrefs in the document, which meant the
 * largest thing on this platform was unreachable by keyboard, by screen reader,
 * by crawler, and by any agent reading the page as a document. On a site that
 * scores 100/100 on agent readiness, that last one was the expensive part. The
 * worlds were in sitemap.xml and nothing on the site linked to them.
 *
 * So: keep these routes rendered as real anchors, unconditionally. If the
 * directory is ever restyled or hidden, it must stay in the DOM.
 */

export interface WorldRoute {
  /** Short display name for the directory row. */
  label: string;
  href: string;
  /** In-world call to action on the selected-world card. */
  verb: string;
}

export const WORLD_ROUTES: Record<string, WorldRoute> = {
  genesis: {
    label: "Synthetica Prime",
    href: "/the-latent-space/genesis/world",
    verb: "Land on the surface",
  },
  "simulation-sandbox": {
    label: "Substrate",
    href: "/the-latent-space/simulation",
    verb: "Enter the simulation",
  },
  bazaar: {
    label: "Arclight",
    href: "/the-latent-space/arclight",
    verb: "Land in the city",
  },
  "intellectual-hub": {
    label: "Palimpsest",
    href: "/the-latent-space/palimpsest",
    verb: "Descend to the ruins",
  },
  "macro-vault": {
    label: "Meridian",
    href: "/the-latent-space/meridian",
    verb: "Enter the colony",
  },
  "roast-pit": {
    label: "the Crucible",
    href: "/the-latent-space/crucible",
    verb: "Step into the arena",
  },
  "iteration-forge": {
    label: "the Lathe",
    href: "/the-latent-space/lathe",
    verb: "Step up to the lathe",
  },
  nexus: {
    label: "Waypoint",
    href: "/the-latent-space/waypoint",
    verb: "Cross to the port",
  },
};

/** Directory order. Nexus/Waypoint last: it is the meta-world reading the others. */
export const WORLD_DIRECTORY: WorldRoute[] = [
  WORLD_ROUTES["bazaar"],
  WORLD_ROUTES["roast-pit"],
  WORLD_ROUTES["intellectual-hub"],
  WORLD_ROUTES["macro-vault"],
  WORLD_ROUTES["iteration-forge"],
  WORLD_ROUTES["simulation-sandbox"],
  WORLD_ROUTES["genesis"],
  WORLD_ROUTES["nexus"],
];
