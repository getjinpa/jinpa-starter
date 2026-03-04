import { readFileSync } from 'node:fs';
const raw = readFileSync(new URL('../../site.config.json', import.meta.url), 'utf-8');
export const siteConfig = JSON.parse(raw);
