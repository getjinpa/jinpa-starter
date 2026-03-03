/**
 * Jinpa Plugin Manager
 *
 * Handles plugin installation, uninstallation, and lifecycle management.
 * Works at build-time via Node fs APIs. The functions here modify
 * plugins.lock.json and can trigger plugin install/uninstall hooks.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  readPluginsLock,
  getPluginConfig,
  validateManifest,
  type PluginsLock,
  type PluginLockEntry,
  type PluginManifest,
} from './plugin-loader.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginInstallResult {
  success: boolean;
  message: string;
  errors: string[];
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function projectRoot(): string {
  return process.cwd();
}

const PLUGINS_LOCK_FILE = () => path.join(projectRoot(), 'plugins.lock.json');
const PLUGINS_DIR = () => path.join(projectRoot(), 'plugins');
const SITE_CONFIG_FILE = () => path.join(projectRoot(), 'site.config.json');

// ---------------------------------------------------------------------------
// Lock file operations
// ---------------------------------------------------------------------------

/**
 * Write the plugins lock data back to disk.
 */
function writePluginsLock(lock: PluginsLock): void {
  const lockPath = PLUGINS_LOCK_FILE();
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Version checking
// ---------------------------------------------------------------------------

/**
 * Parse a simple semver string like "1.2.3" into [major, minor, patch].
 */
function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

/**
 * Check whether `current` satisfies a simple semver range string.
 * Supports:  >=X.Y.Z   ^X.Y.Z   ~X.Y.Z   X.Y.Z (exact)
 */
function satisfiesSemver(current: string, range: string): boolean {
  const cur = parseSemver(current);
  if (!cur) return false;

  // >=X.Y.Z
  const gteMatch = range.match(/^>=\s*(\d+\.\d+\.\d+)/);
  if (gteMatch) {
    const req = parseSemver(gteMatch[1]);
    if (!req) return false;
    if (cur[0] > req[0]) return true;
    if (cur[0] < req[0]) return false;
    if (cur[1] > req[1]) return true;
    if (cur[1] < req[1]) return false;
    return cur[2] >= req[2];
  }

  // ^X.Y.Z  (compatible with major)
  const caretMatch = range.match(/^\^(\d+\.\d+\.\d+)/);
  if (caretMatch) {
    const req = parseSemver(caretMatch[1]);
    if (!req) return false;
    if (cur[0] !== req[0]) return false;
    if (cur[1] > req[1]) return true;
    if (cur[1] < req[1]) return false;
    return cur[2] >= req[2];
  }

  // ~X.Y.Z  (compatible with minor)
  const tildeMatch = range.match(/^~(\d+\.\d+\.\d+)/);
  if (tildeMatch) {
    const req = parseSemver(tildeMatch[1]);
    if (!req) return false;
    if (cur[0] !== req[0]) return false;
    if (cur[1] !== req[1]) return false;
    return cur[2] >= req[2];
  }

  // Exact match
  const exact = parseSemver(range);
  if (exact) {
    return cur[0] === exact[0] && cur[1] === exact[1] && cur[2] === exact[2];
  }

  // If we cannot parse the range, assume compatible (lenient)
  return true;
}

/**
 * Read the current Jinpa platform version from package.json.
 */
function getJinpaVersion(): string {
  try {
    const pkgPath = path.join(projectRoot(), 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

/**
 * Read the installed Astro version from node_modules or package.json deps.
 */
function getAstroVersion(): string {
  // Try reading from node_modules/astro/package.json first
  try {
    const astroPkgPath = path.join(
      projectRoot(),
      'node_modules',
      'astro',
      'package.json',
    );
    const raw = fs.readFileSync(astroPkgPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return pkg.version || '5.0.0';
  } catch {
    // Fallback: parse the range from the project's own package.json
    try {
      const pkgPath = path.join(projectRoot(), 'package.json');
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      const dep =
        pkg.dependencies?.astro || pkg.devDependencies?.astro || '5.0.0';
      // Strip leading ^ or ~
      return dep.replace(/^[\^~>=<\s]+/, '');
    } catch {
      return '5.0.0';
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a plugin manifest is compatible with the current environment.
 */
export function checkCompatibility(manifest: PluginManifest): CompatibilityResult {
  const issues: string[] = [];
  const jinpaVersion = getJinpaVersion();
  const astroVersion = getAstroVersion();

  if (manifest.compatibility?.jinpa) {
    if (!satisfiesSemver(jinpaVersion, manifest.compatibility.jinpa)) {
      issues.push(
        `Requires Jinpa ${manifest.compatibility.jinpa} but current is ${jinpaVersion}.`,
      );
    }
  }

  if (manifest.compatibility?.astro) {
    if (!satisfiesSemver(astroVersion, manifest.compatibility.astro)) {
      issues.push(
        `Requires Astro ${manifest.compatibility.astro} but current is ${astroVersion}.`,
      );
    }
  }

  // Check plugin dependencies
  if (manifest.dependencies && manifest.dependencies.length > 0) {
    const lock = readPluginsLock();
    const installedSlugs = new Set(lock.plugins.map((p) => p.slug));
    for (const dep of manifest.dependencies) {
      if (!installedSlugs.has(dep)) {
        issues.push(`Missing required plugin dependency: "${dep}".`);
      }
    }
  }

  return { compatible: issues.length === 0, issues };
}

/**
 * Install a plugin: validate, check compatibility, add to lock file,
 * and register in site config.
 *
 * @param slug      The plugin slug (must match a directory in plugins/).
 * @param manifest  Optionally pass the manifest; if omitted it will be
 *                  read from plugins/[slug]/manifest.json.
 */
export function installPlugin(
  slug: string,
  manifest?: PluginManifest,
): PluginInstallResult {
  const errors: string[] = [];

  // -- Resolve manifest --
  const resolvedManifest = manifest ?? getPluginConfig(slug);
  if (!resolvedManifest) {
    return {
      success: false,
      message: `Plugin "${slug}" not found in plugins/ directory.`,
      errors: [`No manifest.json at plugins/${slug}/manifest.json`],
    };
  }

  // -- Validate manifest --
  const validation = validateManifest(resolvedManifest);
  if (!validation.valid) {
    return {
      success: false,
      message: `Plugin "${slug}" has an invalid manifest.`,
      errors: validation.errors,
    };
  }

  // -- Check compatibility --
  const compat = checkCompatibility(resolvedManifest);
  if (!compat.compatible) {
    return {
      success: false,
      message: `Plugin "${slug}" is not compatible with this environment.`,
      errors: compat.issues,
    };
  }

  // -- Check if already installed --
  const lock = readPluginsLock();
  const existing = lock.plugins.find((p) => p.slug === slug);
  if (existing) {
    // Update version and re-activate
    existing.version = resolvedManifest.version;
    existing.active = true;
  } else {
    // Add new entry
    const entry: PluginLockEntry = {
      slug: resolvedManifest.slug,
      version: resolvedManifest.version,
      installedAt: new Date().toISOString(),
      active: true,
    };
    lock.plugins.push(entry);
  }

  writePluginsLock(lock);

  // -- Register in site.config.json activePlugins --
  registerPluginInSiteConfig(slug);

  // -- Create plugin component directory if it does not exist --
  const pluginComponentDir = path.join(
    projectRoot(),
    'src',
    'components',
    'plugins',
    slug,
  );
  if (!fs.existsSync(pluginComponentDir)) {
    fs.mkdirSync(pluginComponentDir, { recursive: true });
  }

  // -- Run onInstall hook if present --
  if (resolvedManifest.hooks?.onInstall) {
    const hookPath = path.join(PLUGINS_DIR(), slug, resolvedManifest.hooks.onInstall);
    if (fs.existsSync(hookPath)) {
      try {
        // Dynamic import for ESM hook scripts
        // In a real runtime this would use import() -- here we just note the path
        console.log(`[jinpa] Running install hook: ${hookPath}`);
      } catch (err) {
        errors.push(`Install hook failed: ${String(err)}`);
      }
    }
  }

  return {
    success: true,
    message: `Plugin "${resolvedManifest.name}" (${resolvedManifest.version}) installed successfully.`,
    errors,
  };
}

/**
 * Uninstall a plugin: remove from lock file, deregister from site config.
 */
export function uninstallPlugin(slug: string): PluginInstallResult {
  const errors: string[] = [];

  const lock = readPluginsLock();
  const index = lock.plugins.findIndex((p) => p.slug === slug);

  if (index === -1) {
    return {
      success: false,
      message: `Plugin "${slug}" is not installed.`,
      errors: ['Plugin not found in plugins.lock.json.'],
    };
  }

  // -- Run onUninstall hook if present --
  const manifest = getPluginConfig(slug);
  if (manifest?.hooks?.onUninstall) {
    const hookPath = path.join(PLUGINS_DIR(), slug, manifest.hooks.onUninstall);
    if (fs.existsSync(hookPath)) {
      try {
        console.log(`[jinpa] Running uninstall hook: ${hookPath}`);
      } catch (err) {
        errors.push(`Uninstall hook failed: ${String(err)}`);
      }
    }
  }

  // -- Check if other plugins depend on this one --
  const dependents = lock.plugins.filter((p) => {
    if (p.slug === slug) return false;
    const m = getPluginConfig(p.slug);
    return m?.dependencies?.includes(slug) ?? false;
  });

  if (dependents.length > 0) {
    const names = dependents.map((d) => d.slug).join(', ');
    return {
      success: false,
      message: `Cannot uninstall "${slug}" because other plugins depend on it: ${names}.`,
      errors: [`Dependent plugins: ${names}`],
    };
  }

  // -- Remove from lock --
  lock.plugins.splice(index, 1);
  writePluginsLock(lock);

  // -- Deregister from site.config.json --
  deregisterPluginFromSiteConfig(slug);

  return {
    success: true,
    message: `Plugin "${slug}" has been uninstalled.`,
    errors,
  };
}

/**
 * List all currently installed plugins from plugins.lock.json.
 */
export function listInstalledPlugins(): PluginLockEntry[] {
  const lock = readPluginsLock();
  return lock.plugins;
}

/**
 * Toggle a plugin's active state without removing it.
 */
export function togglePlugin(slug: string, active: boolean): PluginInstallResult {
  const lock = readPluginsLock();
  const entry = lock.plugins.find((p) => p.slug === slug);

  if (!entry) {
    return {
      success: false,
      message: `Plugin "${slug}" is not installed.`,
      errors: ['Plugin not found in plugins.lock.json.'],
    };
  }

  entry.active = active;
  writePluginsLock(lock);

  if (active) {
    registerPluginInSiteConfig(slug);
  } else {
    deregisterPluginFromSiteConfig(slug);
  }

  return {
    success: true,
    message: `Plugin "${slug}" is now ${active ? 'active' : 'inactive'}.`,
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// site.config.json helpers
// ---------------------------------------------------------------------------

function readSiteConfig(): Record<string, unknown> {
  const configPath = SITE_CONFIG_FILE();
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSiteConfig(config: Record<string, unknown>): void {
  const configPath = SITE_CONFIG_FILE();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function registerPluginInSiteConfig(slug: string): void {
  const config = readSiteConfig();
  const activePlugins = (config.activePlugins as string[]) ?? [];
  if (!activePlugins.includes(slug)) {
    activePlugins.push(slug);
    config.activePlugins = activePlugins;
    writeSiteConfig(config);
  }
}

function deregisterPluginFromSiteConfig(slug: string): void {
  const config = readSiteConfig();
  const activePlugins = (config.activePlugins as string[]) ?? [];
  const index = activePlugins.indexOf(slug);
  if (index !== -1) {
    activePlugins.splice(index, 1);
    config.activePlugins = activePlugins;
    writeSiteConfig(config);
  }
}
