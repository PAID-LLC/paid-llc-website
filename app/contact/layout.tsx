import V2Frame from "@/components/v2/V2Frame";

// Contact in the v2 frame — dark skin via the shared .v2-blog remap.
// The form must stay usable: inputs get explicit dark styles in globals.css
// (.v2-blog input/textarea/select overrides).
export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <V2Frame>
      <div className="v2-blog">{children}</div>
    </V2Frame>
  );
}
