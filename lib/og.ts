// Default link-preview image. Next.js replaces a parent's `openGraph` object
// wholesale when a page sets its own, so any page with an `openGraph` block
// loses the root layout's image unless it repeats it. 18 pages had done
// exactly that, /website-audit among them (2026-10-11 site test).
export const DEFAULT_OG_IMAGES = [
  { url: "/logo.png", width: 512, height: 512, alt: "paiddev.com" },
];
