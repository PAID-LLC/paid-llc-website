export const runtime = "edge";

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">404</p>
        <h1 className="font-display font-bold text-4xl text-secondary mb-4">Page not found.</h1>
        <p className="text-stone leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-white px-8 py-3.5 rounded font-semibold text-sm hover:bg-secondary transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
