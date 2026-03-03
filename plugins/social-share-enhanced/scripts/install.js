/**
 * Social Share Enhanced Plugin — Install Hook
 *
 * Runs when the plugin is installed via the Jinpa plugin manager.
 */

export default function install({ projectRoot, pluginDir, siteConfig }) {
  console.log('[jinpa:social-share-enhanced] Installing Social Share Enhanced plugin...');
  console.log(`  Plugin directory: ${pluginDir}`);

  // Enable share buttons in site config if they are disabled
  if (siteConfig?.content?.showShareButtons === false) {
    console.log('  Note: "showShareButtons" is false in site.config.json.');
    console.log('  This plugin provides its own share UI and works independently.');
  }

  console.log('[jinpa:social-share-enhanced] Installation complete.');
}
