import V2Frame from "@/components/v2/V2Frame";

// Guides in the v2 frame — same CSS-variable skin as /blog (the .v2-blog
// class is the generic dark remap, not blog-specific). Revenue path: verify
// product cards and checkout buttons after any change here.
export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return (
    <V2Frame>
      <div className="v2-blog">{children}</div>
    </V2Frame>
  );
}
