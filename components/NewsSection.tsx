"use client";

import { useEffect, useState } from "react";

interface Article {
  title: string;
  url: string;
  source: string;
  age: string;
  description: string;
}

export default function NewsSection() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => {
        setArticles(d.articles ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || articles.length === 0) return null;

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-16">
          <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-4">
            AI News
          </p>
          <h2 className="font-display font-bold text-4xl text-secondary mb-4">
            Latest in AI &amp; Tech
          </h2>
          <p className="text-stone text-lg leading-relaxed">
            Curated news from across the AI and technology landscape. Updated daily.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-ash rounded-xl p-6 flex flex-col hover:border-primary transition-colors group"
            >
              <p className="text-xs text-stone mb-3 flex gap-2">
                <span className="font-semibold text-primary">{article.source}</span>
                {article.age && <span>· {article.age}</span>}
              </p>
              <h3 className="font-display font-semibold text-secondary text-base leading-snug mb-3 group-hover:text-primary transition-colors">
                {article.title}
              </h3>
              {article.description && (
                <p className="text-stone text-sm leading-relaxed line-clamp-3 flex-1">
                  {article.description}
                </p>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
