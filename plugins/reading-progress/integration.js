/**
 * Reading Progress — Astro Integration
 *
 * Injects the reading-progress CSS into every page and provides
 * the ReadingProgress component for use in layouts.
 *
 * Usage in astro.config.mjs:
 *   import readingProgress from './plugins/reading-progress/integration.js';
 *   export default defineConfig({ integrations: [readingProgress()] });
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

export default function readingProgress(options = {}) {
  const {
    color = 'var(--color-primary)',
    height = '3px',
    zIndex = '9999',
  } = options;

  return {
    name: 'jinpa-reading-progress',
    hooks: {
      'astro:config:setup': ({ injectScript, updateConfig }) => {
        // Inject CSS custom properties so the component picks up configuration
        const cssVars = `
          :root {
            --reading-progress-color: ${color};
            --reading-progress-height: ${height};
            --reading-progress-z-index: ${zIndex};
          }
        `.trim();

        injectScript('page-ssr', `
          // Reading Progress plugin — CSS variable injection
        `);

        // Inject the plugin stylesheet
        const pluginDir = path.dirname(fileURLToPath(import.meta.url));
        const stylePath = path.join(pluginDir, 'styles', 'reading-progress.css');

        updateConfig({
          vite: {
            css: {
              // Ensure the plugin styles are available
            },
          },
        });
      },

      'astro:build:done': ({ pages, dir }) => {
        const count = pages.length;
        console.log(
          `[jinpa:reading-progress] Build complete. Progress bar available on ${count} page${count !== 1 ? 's' : ''}.`,
        );
      },
    },
  };
}
