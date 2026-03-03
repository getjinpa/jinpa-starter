/**
 * Jinpa Base Path Utilities
 *
 * Provides helpers for prepending the Astro base path to URLs.
 * Uses import.meta.env.BASE_URL which returns:
 *   - "/" for root-hosted sites
 *   - "/vdog/" for project-hosted sites (always has trailing slash)
 */

/**
 * Get the base path. Returns "/" or "/repo-name/" etc.
 */
export function getBase(): string {
  return import.meta.env.BASE_URL;
}

/**
 * Prepend the base path to an absolute path.
 *
 * Examples (base = "/vdog/"):
 *   withBase("/posts/")     -> "/vdog/posts/"
 *   withBase("/")           -> "/vdog/"
 *   withBase("/favicon.svg") -> "/vdog/favicon.svg"
 *
 * Examples (base = "/"):
 *   withBase("/posts/")     -> "/posts/"
 *   withBase("/")           -> "/"
 *
 * Does NOT double-prepend if the path already starts with the base.
 * Ignores external URLs (http://, https://, //, #).
 */
export function withBase(path: string): string {
  if (!path || path.startsWith('http') || path.startsWith('//') || path.startsWith('#')) {
    return path;
  }

  const base = getBase();

  if (base === '/') {
    return path;
  }

  if (path.startsWith(base)) {
    return path;
  }

  if (path.startsWith('/')) {
    return base + path.slice(1);
  }

  return base + path;
}

/**
 * Strip the base path from a URL pathname, for comparison purposes.
 * Useful for active-link detection in navigation.
 *
 * stripBase("/vdog/posts/") -> "/posts/"
 * stripBase("/posts/")      -> "/posts/"  (when base is "/")
 */
export function stripBase(pathname: string): string {
  const base = getBase();
  if (base === '/') return pathname;
  if (pathname.startsWith(base)) {
    return '/' + pathname.slice(base.length);
  }
  return pathname;
}
