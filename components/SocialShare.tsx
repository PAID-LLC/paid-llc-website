"use client";

import { useState } from "react";

interface SocialShareProps {
  title: string;
  slug: string;
}

export default function SocialShare({ title, slug }: SocialShareProps) {
  const [copied, setCopied] = useState(false);
  const url = `https://paiddev.com/blog/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}&via=paiddevllc`;
  const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-stone text-xs uppercase tracking-widest">
        Share
      </span>
      <a
        href={xUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-ash rounded px-3 py-2 text-stone text-xs hover:border-primary hover:text-primary transition-colors"
      >
        X / Twitter
      </a>
      <a
        href={liUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="border border-ash rounded px-3 py-2 text-stone text-xs hover:border-primary hover:text-primary transition-colors"
      >
        LinkedIn
      </a>
      <button
        onClick={handleCopy}
        className="border border-ash rounded px-3 py-2 text-stone text-xs hover:border-primary hover:text-primary transition-colors"
      >
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
