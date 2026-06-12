import V2Frame from "@/components/v2/V2Frame";

// Free resources (lead magnets) in the v2 frame — visitors arrive from the
// blog strip, which is v2-styled; keep the journey consistent.
export default function FreeLayout({ children }: { children: React.ReactNode }) {
  return (
    <V2Frame>
      <div className="v2-blog">{children}</div>
    </V2Frame>
  );
}
