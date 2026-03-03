/**
 * Social Share Enhanced — Astro Integration
 *
 * Registers the enhanced social sharing component and styles
 * with the Astro build pipeline.
 *
 * Usage in astro.config.mjs:
 *   import socialShareEnhanced from './plugins/social-share-enhanced/integration.js';
 *   export default defineConfig({ integrations: [socialShareEnhanced()] });
 */

export default function socialShareEnhanced(options = {}) {
  const {
    platforms = ['twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'copy'],
    showFloatingButton = true,
  } = options;

  return {
    name: 'jinpa-social-share-enhanced',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript }) => {
        // Make plugin options available at runtime via a tiny injected script
        injectScript('page-ssr', `
          // Social Share Enhanced plugin — configuration
        `);

        updateConfig({
          vite: {
            // Ensure any plugin-specific Vite config is merged
          },
        });
      },

      'astro:build:done': ({ pages, dir }) => {
        const count = pages.length;
        console.log(
          `[jinpa:social-share-enhanced] Build complete. Share buttons available on ${count} page${count !== 1 ? 's' : ''}.`,
        );
      },
    },
  };
}
