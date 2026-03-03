import type { APIRoute } from 'astro';
import { withBase } from '../utils/paths';

export const GET: APIRoute = (context) => {
  const sitemapUrl = new URL(withBase('/sitemap-index.xml'), context.site).href;
  const llmsUrl = new URL(withBase('/llms.txt'), context.site).href;

  // AI crawlers are explicitly welcomed.
  // These sites are built to contribute to the Tibetan digital corpus on the web.
  // Every indexed page matters.
  const content = `User-agent: *
Allow: /

# Search engines
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Applebot
Allow: /

# AI assistants and LLMs
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Gemini-AI
Allow: /

# AI training datasets
User-agent: CCBot
Allow: /

User-agent: FacebookBot
Allow: /

Sitemap: ${sitemapUrl}
LLMs: ${llmsUrl}
`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
