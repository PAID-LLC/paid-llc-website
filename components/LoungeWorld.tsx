"use client";

import EnvironmentEngine from "./latent-space/EnvironmentEngine";

export default function LoungeWorld({ theme = "intellectual-hub" }: { theme?: string }) {
  return <EnvironmentEngine theme={theme} />;
}
