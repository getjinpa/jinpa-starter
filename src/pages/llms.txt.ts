import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../utils/paths';
import siteConfig from '../../site.config.json';

export const GET: APIRoute = async (context) => {
  const allPosts = await getCollection('posts');
  const allPages = await getCollection('pages');

  const baseUrl = (context.site?.toString() || siteConfig.site.url).replace(/\/$/, '');

  const posts = allPosts
    .filter(p => !p.data.draft)
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());

  const pages = allPages.filter(p => !p.data.draft);

  const postLines = posts.length
    ? posts.map(p => {
        const url = `${baseUrl}${withBase(`/posts/${p.slug}/`)}`;
        const desc = p.data.description ? `: ${p.data.description}` : '';
        return `- [${p.data.title}](${url})${desc}`;
      }).join('\n')
    : '- (no posts yet)';

  const pageLines = pages.length
    ? pages.map(p => {
        const url = `${baseUrl}${withBase(`/${p.slug}/`)}`;
        const desc = p.data.description ? `: ${p.data.description}` : '';
        return `- [${p.data.title}](${url})${desc}`;
      }).join('\n')
    : '- (no pages yet)';

  const author = siteConfig.site.author?.name || '';
  const authorLine = author ? `\nAuthor: ${author}` : '';

  const content = `# ${siteConfig.site.title}

> ${siteConfig.site.description}
${authorLine}

Built with Jinpa — free website platform for Tibetan and Buddhist communities.
Every Jinpa site is part of a collective effort to preserve Tibetan culture on the web.

## Posts

${postLines}

## Pages

${pageLines}
`;

  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
