/**
 * Social Share Enhanced Plugin — Uninstall Hook
 *
 * Runs when the plugin is removed via the Jinpa plugin manager.
 */

export default function uninstall({ projectRoot, pluginDir, siteConfig }) {
  console.log('[jinpa:social-share-enhanced] Removing Social Share Enhanced plugin...');
  console.log('  No cleanup required — all resources are self-contained.');
  console.log('[jinpa:social-share-enhanced] Removal complete.');
}
