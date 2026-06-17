import V2Frame from "@/components/v2/V2Frame";

// Free resources (lead magnets): v2-native (rebuilt 2026-06-17). The page +
// CaptureForm compose from components/v2/tokens, so no .v2-blog skin remap is
// needed; inputs/button carry explicit dark v2 classes.
export default function FreeLayout({ children }: { children: React.ReactNode }) {
  return <V2Frame>{children}</V2Frame>;
}
