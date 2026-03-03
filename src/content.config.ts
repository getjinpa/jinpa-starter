import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// ─── Posts ──────────────────────────────────────────────
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      // REQUIRED
      title: z.string().max(200),
      date: z.coerce.date(),

      // OPTIONAL — all reserved names
      description: z.string().max(300).optional(),
      author: z.string().optional(),
      image: image().optional(),
      image_alt: z.string().optional(),
      tags: z.array(z.string()).default([]),
      categories: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      lang: z.string().default('en'),
      layout: z.string().default('Post'),
      slug: z.string().optional(),
      excerpt: z.string().optional(),
      updated: z.coerce.date().optional(),
    }),
});

// ─── Pages ──────────────────────────────────────────────
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: ({ image }) =>
    z.object({
      // REQUIRED
      title: z.string(),

      // OPTIONAL
      description: z.string().optional(),
      image: image().optional(),
      layout: z.string().default('Page'),
      lang: z.string().default('en'),
      order: z.number().default(0),
      parent: z.string().optional(),
      show_in_nav: z.boolean().default(true),
    }),
});

export const collections = { posts, pages };
