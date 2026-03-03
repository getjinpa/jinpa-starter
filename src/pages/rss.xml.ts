import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { withBase } from '../utils/paths';
import siteConfig from '../../site.config.json';

export async function GET(context: { site: URL }) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  const sortedPosts = posts.sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  );

  // Build full site URL including base path
  const siteUrl = new URL(withBase('/'), context.site).href;

  return rss({
    title: siteConfig.site.title,
    description: siteConfig.site.description,
    site: siteUrl,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: new Date(post.data.date),
      description: post.data.description || '',
      link: `posts/${post.id}/`,
    })),
  });
}
