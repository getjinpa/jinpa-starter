/**
 * Jinpa Plugin Loader
 *
 * Implements the Template Resolution Chain (Spec Section 4.5):
 *   1. src/components/plugins/[active-plugin]/Component.astro  -- Plugin override
 *   2. src/components/theme/Component.astro                    -- Theme version
 *   3. src/components/core/Component.astro                     -- Platform default
 *
 * First match wins. This module is designed to work at build time
 * (inside Astro frontmatter / config) via Node fs APIs.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginLockEntry {
  slug: string;
  version: string;
  installedAt: string;
  active: boolean;
}

export interface PluginsLock {
  version: number;
  plugins: PluginLockEntry[];
}

export interface PluginPropDef {
  type: string;
  default?: unknown;
}

export interface PluginComponentDef {
  name: string;
  file: string;
  framework: string;
  hydration: string;
  description: string;
  props: Record<string, PluginPropDef>;
}

export interface PluginProvides {
  components: PluginComponentDef[];
  styles: string[];
  contentTypes: string[];
  adminExtensions: string[];
}

export interface PluginFrontmatterField {
  name: string;
  type: string;
  appliesTo: string;
  description: string;
}

export interface PluginManifest {
  $schema: string;
  specVersion: number;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
  authorUrl: string;
  license: string;
  homepage: string;
  repository: string;
  compatibility: {
    jinpa: string;
    astro: string;
  };
  provides: PluginProvides;
  integration: string;
  frontmatter: {
    fields: PluginFrontmatterField[];
  };
  hooks: {
    onInstall: string;
    onUninstall: string;
  };
  dependencies: string[];
  assets: {
    icon: string;
    screenshots: string[];
  };
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Paths  (resolved relative to project root)
// ---------------------------------------------------------------------------

/** Determine the project root -- works inside Astro build context. */
function projectRoot(): string {
  // During an Astro build the cwd is always the project root.
  return process.cwd();
}

const PLUGINS_LOCK_FILE = () => path.join(projectRoot(), 'plugins.lock.json');
const PLUGINS_DIR = () => path.join(projectRoot(), 'plugins');
const COMPONENTS_PLUGINS_DIR = () =>
  path.join(projectRoot(), 'src', 'components', 'plugins');
const COMPONENTS_THEME_DIR = () =>
  path.join(projectRoot(), 'src', 'components', 'theme');
const COMPONENTS_CORE_DIR = () =>
  path.join(projectRoot(), 'src', 'components', 'core');

// ---------------------------------------------------------------------------
// plugins.lock.json helpers
// ---------------------------------------------------------------------------

/**
 * Read and parse plugins.lock.json.
 * Returns a default structure when the file is missing.
 */
export function readPluginsLock(): PluginsLock {
  const lockPath = PLUGINS_LOCK_FILE();
  try {
    const raw = fs.readFileSync(lockPath, 'utf-8');
    return JSON.parse(raw) as PluginsLock;
  } catch {
    return { version: 1, plugins: [] };
  }
}

/**
 * Return only the plugins whose `active` flag is true.
 */
export function getActivePlugins(): PluginLockEntry[] {
  const lock = readPluginsLock();
  return lock.plugins.filter((p) => p.active);
}

// ---------------------------------------------------------------------------
// Template Resolution Chain
// ---------------------------------------------------------------------------

/**
 * Resolve a component name through the three-tier lookup chain.
 *
 * @param name  The component filename, e.g. "PostCard.astro".
 * @returns     The absolute path of the first matching file, or `null`
 *              if none of the tiers contain that component.
 *
 * Resolution order:
 *   1. Active plugin component directories (in the order they appear
 *      in plugins.lock.json)
 *   2. Theme component directory
 *   3. Core component directory
 */
export function resolveComponent(name: string): string | null {
  const activePlugins = getActivePlugins();

  // 1. Plugin overrides  -- each active plugin may supply its own version
  for (const plugin of activePlugins) {
    const pluginComponentPath = path.join(
      COMPONENTS_PLUGINS_DIR(),
      plugin.slug,
      name,
    );
    if (fs.existsSync(pluginComponentPath)) {
      return pluginComponentPath;
    }
  }

  // 2. Theme override
  const themePath = path.join(COMPONENTS_THEME_DIR(), name);
  if (fs.existsSync(themePath)) {
    return themePath;
  }

  // 3. Core (platform default)
  const corePath = path.join(COMPONENTS_CORE_DIR(), name);
  if (fs.existsSync(corePath)) {
    return corePath;
  }

  return null;
}

/**
 * Return all resolution paths that were checked for a component (useful for
 * debugging or admin UI display).
 */
export function resolveComponentChain(
  name: string,
): { path: string; exists: boolean; tier: string }[] {
  const chain: { path: string; exists: boolean; tier: string }[] = [];
  const activePlugins = getActivePlugins();

  for (const plugin of activePlugins) {
    const p = path.join(COMPONENTS_PLUGINS_DIR(), plugin.slug, name);
    chain.push({ path: p, exists: fs.existsSync(p), tier: `plugin:${plugin.slug}` });
  }

  const themePath = path.join(COMPONENTS_THEME_DIR(), name);
  chain.push({ path: themePath, exists: fs.existsSync(themePath), tier: 'theme' });

  const corePath = path.join(COMPONENTS_CORE_DIR(), name);
  chain.push({ path: corePath, exists: fs.existsSync(corePath), tier: 'core' });

  return chain;
}

// ---------------------------------------------------------------------------
// Plugin Config
// ---------------------------------------------------------------------------

/**
 * Read a plugin's manifest.json from the plugins/ directory.
 *
 * @param slug  The plugin slug, e.g. "reading-progress".
 * @returns     The parsed manifest, or `null` when the file does not exist.
 */
export function getPluginConfig(slug: string): PluginManifest | null {
  const manifestPath = path.join(PLUGINS_DIR(), slug, 'manifest.json');
  try {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw) as PluginManifest;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Manifest Validation
// ---------------------------------------------------------------------------

const REQUIRED_MANIFEST_FIELDS: (keyof PluginManifest)[] = [
  'specVersion',
  'name',
  'slug',
  'version',
  'description',
  'author',
  'license',
  'compatibility',
  'provides',
  'integration',
];

/**
 * Validate a plugin manifest object against the spec requirements.
 * Returns a result with a `valid` flag and an array of error strings.
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object.'] };
  }

  const m = manifest as Record<string, unknown>;

  // -- Required top-level fields --
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (m[field] === undefined || m[field] === null) {
      errors.push(`Missing required field: "${field}".`);
    }
  }

  // -- specVersion must be a positive integer --
  if (typeof m.specVersion !== 'number' || m.specVersion < 1) {
    errors.push('"specVersion" must be a positive integer.');
  }

  // -- slug format: lowercase alphanumeric + hyphens --
  if (typeof m.slug === 'string' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug)) {
    errors.push(
      '"slug" must be lowercase alphanumeric with hyphens (e.g. "my-plugin").',
    );
  }

  // -- version must look like semver --
  if (
    typeof m.version === 'string' &&
    !/^\d+\.\d+\.\d+/.test(m.version)
  ) {
    errors.push('"version" must follow semver (e.g. "1.0.0").');
  }

  // -- compatibility object --
  if (m.compatibility && typeof m.compatibility === 'object') {
    const compat = m.compatibility as Record<string, unknown>;
    if (typeof compat.jinpa !== 'string') {
      errors.push('"compatibility.jinpa" must be a semver range string.');
    }
    if (typeof compat.astro !== 'string') {
      errors.push('"compatibility.astro" must be a semver range string.');
    }
  }

  // -- provides object structure --
  if (m.provides && typeof m.provides === 'object') {
    const provides = m.provides as Record<string, unknown>;
    if (!Array.isArray(provides.components)) {
      errors.push('"provides.components" must be an array.');
    }
    if (!Array.isArray(provides.styles)) {
      errors.push('"provides.styles" must be an array.');
    }
    if (!Array.isArray(provides.contentTypes)) {
      errors.push('"provides.contentTypes" must be an array.');
    }
    if (!Array.isArray(provides.adminExtensions)) {
      errors.push('"provides.adminExtensions" must be an array.');
    }

    // Validate each component definition
    if (Array.isArray(provides.components)) {
      for (const comp of provides.components as Record<string, unknown>[]) {
        if (!comp.name || typeof comp.name !== 'string') {
          errors.push('Each component in "provides.components" must have a "name" string.');
        }
        if (!comp.file || typeof comp.file !== 'string') {
          errors.push('Each component in "provides.components" must have a "file" string.');
        }
      }
    }
  }

  // -- integration path --
  if (typeof m.integration !== 'string' || m.integration.length === 0) {
    errors.push('"integration" must be a non-empty string path.');
  }

  // -- license --
  const VALID_LICENSES = ['free', 'MIT', 'Apache-2.0', 'GPL-3.0', 'proprietary'];
  if (
    typeof m.license === 'string' &&
    !VALID_LICENSES.includes(m.license) &&
    !m.license.startsWith('SEE ')
  ) {
    errors.push(
      `"license" should be one of: ${VALID_LICENSES.join(', ')} (got "${m.license}").`,
    );
  }

  // -- CSS class prefix validation (components styles) --
  if (typeof m.slug === 'string' && m.provides && typeof m.provides === 'object') {
    const provides = m.provides as Record<string, unknown>;
    if (Array.isArray(provides.styles)) {
      // We just note the requirement -- actual CSS prefix checking happens at install time
    }
  }

  // -- frontmatter fields must be prefixed with slug --
  if (m.frontmatter && typeof m.frontmatter === 'object') {
    const fm = m.frontmatter as Record<string, unknown>;
    if (Array.isArray(fm.fields)) {
      for (const field of fm.fields as Record<string, unknown>[]) {
        if (
          typeof field.name === 'string' &&
          typeof m.slug === 'string' &&
          !field.name.startsWith(`${m.slug}_`)
        ) {
          errors.push(
            `Frontmatter field "${field.name}" must be prefixed with the plugin slug ("${m.slug}_").`,
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Utility: list all plugin manifests in the plugins/ directory
// ---------------------------------------------------------------------------

/**
 * Scan the plugins/ directory and return all valid manifests found.
 */
export function discoverPlugins(): PluginManifest[] {
  const pluginsDir = PLUGINS_DIR();
  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  const manifests: PluginManifest[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(pluginsDir, entry.name, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        manifests.push(JSON.parse(raw) as PluginManifest);
      } catch {
        // Skip manifests that fail to parse
      }
    }
  }

  return manifests;
}

// ---------------------------------------------------------------------------
// Utility: get styles for all active plugins
// ---------------------------------------------------------------------------

/**
 * Return absolute paths to all CSS files registered by active plugins.
 * Useful for injecting into the Astro build.
 */
export function getActivePluginStyles(): string[] {
  const activePlugins = getActivePlugins();
  const styles: string[] = [];

  for (const entry of activePlugins) {
    const manifest = getPluginConfig(entry.slug);
    if (!manifest) continue;

    for (const stylePath of manifest.provides.styles) {
      const abs = path.join(PLUGINS_DIR(), entry.slug, stylePath);
      if (fs.existsSync(abs)) {
        styles.push(abs);
      }
    }
  }

  return styles;
}
