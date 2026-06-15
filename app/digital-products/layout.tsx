import V2Frame from "@/components/v2/V2Frame";

// Guides: v2-native (rebuilt 2026-06-15). The page + ProductsGrid compose from
// components/v2/tokens, so no .v2-blog skin remap is needed (that was the
// interim dark wrapper). Revenue path: verify product cards and checkout
// buttons after any change here.
export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <V2Frame>{children}</V2Frame>;
}
