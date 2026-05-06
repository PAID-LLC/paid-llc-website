import GithubSlugger from "github-slugger";
import { BLOG_FILES_RAW } from "./generated-blog-data";

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  formattedDate: string;
  author: string;
  excerpt: string;
  category: string;
  tags: string[];
  featured_image: string;
  og_image?: string;
  published: boolean;
  content: string;
  readTime: number;
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export const CATEGORIES = [
  "AI Strategy",
  "Agentic Commerce",
  "Building PAID LLC",
  "Tools & Stack",
] as const;
export type Category = (typeof CATEGORIES)[number];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function calcReadTime(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

export function extractHeadings(content: string): Heading[] {
  const slugger = new GithubSlugger();
  const regex = /^(#{1,3})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    headings.push({ level, text, id: slugger.slug(text) });
  }
  return headings;
}

function buildPost(entry: { filename: string; frontmatter: Record<string, unknown>; content: string }): BlogPost {
  const d = entry.frontmatter;
  const slug = (d.slug as string) || entry.filename.replace(".mdx", "");
  return {
    slug,
    title: d.title as string,
    date: d.date as string,
    formattedDate: formatDate(d.date as string),
    author: (d.author as string) || "Arti Intel",
    excerpt: d.excerpt as string,
    category: d.category as string,
    tags: (d.tags as string[]) || [],
    featured_image: (d.featured_image as string) || "",
    og_image: d.og_image as string | undefined,
    published: d.published !== false,
    content: entry.content,
    readTime: calcReadTime(entry.content),
  };
}

export function getAllPosts(): BlogPost[] {
  return BLOG_FILES_RAW
    .map(buildPost)
    .filter((p) => p.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const entry = BLOG_FILES_RAW.find((e) => {
    const candidate = buildPost(e);
    return candidate.slug === slug;
  });
  return entry ? buildPost(entry) : null;
}

export function getRelatedPosts(
  currentSlug: string,
  category: string,
  tags: string[],
  count = 3
): BlogPost[] {
  return getAllPosts()
    .filter((p) => p.slug !== currentSlug)
    .map((p) => ({
      post: p,
      score:
        (p.category === category ? 2 : 0) +
        p.tags.filter((t) => tags.includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ post }) => post);
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}
