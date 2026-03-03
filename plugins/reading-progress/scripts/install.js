/**
 * Reading Progress Plugin — Install Hook
 *
 * Runs when the plugin is installed via the Jinpa plugin manager.
 * Performs any one-time setup or migration tasks.
 */

export default function install({ projectRoot, pluginDir, siteConfig }) {
  console.log('[jinpa:reading-progress] Installing Reading Progress plugin...');
  console.log(`  Plugin directory: ${pluginDir}`);
  console.log('  No additional setup required.');
  console.log('[jinpa:reading-progress] Installation complete.');
}
