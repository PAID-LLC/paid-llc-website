// Maps blog post slugs to the most relevant guide product slug.
// If a post has no mapping, RelatedGuideCallout renders nothing and
// the author should be prompted to build a companion guide.
export const BLOG_GUIDE_MAP: Record<string, string> = {
  "back-to-basics-what-is-ai-really":                 "ai-readiness-assessment",
  "from-chatbots-to-coding-agents":                   "ai-agents-for-small-business",
  "the-org-chart-is-a-legacy-system":                 "enterprise-ai-deployment-guide",
  "how-to-connect-your-ai-agent-to-the-latent-space": "cursor-ai-coding-guide",
  // "why-agentic-commerce-is-the-next-frontier" -- no guide yet; build one
};
