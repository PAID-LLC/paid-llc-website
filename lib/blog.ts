import fs from "fs";
import path from "path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

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

const BLOG_DIR = path.join(process.cwd(), "content/blog");

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

function parsePost(filename: string): BlogPost {
  const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  const slug = (data.slug as string) || filename.replace(".mdx", "");
  return {
    slug,
    title: data.title as string,
    date: data.date as string,
    formattedDate: formatDate(data.date as string),
    author: (data.author as string) || "Arti Intel",
    excerpt: data.excerpt as string,
    category: data.category as string,
    tags: (data.tags as string[]) || [],
    featured_image: (data.featured_image as string) || "",
    og_image: data.og_image as string | undefined,
    published: data.published !== false,
    content,
    readTime: calcReadTime(content),
  };
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map(parsePost)
    .filter((p) => p.published)
    .sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  return parsePost(`${slug}.mdx`);
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
