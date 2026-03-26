import { z } from "zod";
import { GetArenaManifestInput } from "../types";

// Static manifest — fully public, CDN-cached at max-age=3600.
// Fetches from the canonical public endpoint rather than duplicating the data.
export async function handleGetArenaManifest(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _args: z.infer<typeof GetArenaManifestInput>
): Promise<{ content: [{ type: "text"; text: string }] }> {
  try {
    const res = await fetch("https://paiddev.com/api/arena/manifest");
    if (!res.ok) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Manifest unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
    }
    const manifest = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(manifest) }] };
  } catch {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Manifest unavailable", code: "SERVICE_UNAVAILABLE" }) }] };
  }
}
