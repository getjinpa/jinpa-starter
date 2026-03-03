import type { APIRoute } from 'astro';
import { withBase } from '../utils/paths';

export const GET: APIRoute = (context) => {
  const sitemapUrl = new URL(withBase('/sitemap-index.xml'), context.site).href;

  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
};
