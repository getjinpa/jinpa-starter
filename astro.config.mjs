// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

const siteConfig = JSON.parse(readFileSync('./site.config.json', 'utf-8'));

const base = siteConfig.site.basePath || undefined;

export default defineConfig({
  site: siteConfig.site.url,
  ...(base && { base }),
  trailingSlash: 'always',
  image: {
    layout: 'constrained',
  },
  integrations: [
    sitemap(),
  ],
});
