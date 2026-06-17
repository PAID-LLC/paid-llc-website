import V2Frame from "@/components/v2/V2Frame";

// Contact: v2-native (rebuilt 2026-06-17). The page + ContactForm compose from
// components/v2/tokens, so no .v2-blog skin remap is needed (that was the
// interim dark wrapper). Inputs/button carry explicit dark v2 classes.
export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <V2Frame>{children}</V2Frame>;
}
