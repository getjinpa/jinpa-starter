/**
 * Reading Progress Plugin — Uninstall Hook
 *
 * Runs when the plugin is removed via the Jinpa plugin manager.
 * Cleans up any data or configuration the plugin created.
 */

export default function uninstall({ projectRoot, pluginDir, siteConfig }) {
  console.log('[jinpa:reading-progress] Removing Reading Progress plugin...');
  console.log('  No cleanup required — all resources are self-contained.');
  console.log('[jinpa:reading-progress] Removal complete.');
}
