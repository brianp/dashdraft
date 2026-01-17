/**
 * Path Allowlist Logic
 *
 * Determines which paths are editable based on repository configuration.
 */

import type { RepoConfig } from '@/lib/types/api';
import { normalizePath, matchesAllowedPath } from '@/lib/security/validate';

// ============================================================================
// Path Filtering
// ============================================================================

/**
 * Check if a path is allowed for editing based on repo config
 */
export function isPathAllowed(path: string, config: RepoConfig): boolean {
  const normalized = normalizePath(path);
  if (!normalized) {
    return false;
  }

  // Check against allowed patterns
  return matchesAllowedPath(normalized, config.allowPaths);
}

/**
 * Check if a file has an allowed extension
 */
export function hasAllowedExtension(path: string, config: RepoConfig): boolean {
  const normalized = normalizePath(path);
  if (!normalized) {
    return false;
  }

  const extension = getExtension(normalized);
  return config.allowedExtensions.includes(extension);
}

/**
 * Check if a path is within the docs root
 */
export function isWithinDocsRoot(path: string, config: RepoConfig): boolean {
  const normalized = normalizePath(path);
  if (!normalized) {
    return false;
  }

  // Empty or '.' docs root means everything is allowed
  if (!config.docsRoot || config.docsRoot === '.') {
    return true;
  }

  const docsRoot = normalizePath(config.docsRoot);
  if (!docsRoot) {
    return true;
  }

  return normalized === docsRoot || normalized.startsWith(docsRoot + '/');
}

/**
 * Comprehensive check: is this file editable?
 */
export function isFileEditable(path: string, config: RepoConfig): boolean {
  return (
    isPathAllowed(path, config) &&
    hasAllowedExtension(path, config) &&
    isWithinDocsRoot(path, config)
  );
}

// ============================================================================
// Path Utilities
// ============================================================================

/**
 * Get file extension including the dot
 */
export function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return '';
  }
  return path.slice(lastDot);
}

/**
 * Get the directory part of a path
 */
export function getDirectory(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) {
    return '';
  }
  return path.slice(0, lastSlash);
}

/**
 * Get the filename part of a path
 */
export function getFilename(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) {
    return path;
  }
  return path.slice(lastSlash + 1);
}

/**
 * Join path segments
 */
export function joinPath(...segments: string[]): string {
  return segments
    .filter((s) => s && s !== '.')
    .join('/')
    .replace(/\/+/g, '/');
}

// ============================================================================
// Filtering Functions
// ============================================================================

/**
 * Filter directory entries to only show editable files and directories
 * that might contain editable files
 */
export function filterEditableEntries<T extends { path: string; type: 'file' | 'dir' }>(
  entries: T[],
  config: RepoConfig
): T[] {
  return entries.filter((entry) => {
    if (entry.type === 'dir') {
      // Always show directories - they might contain editable files
      // In v2, we could optimize by checking if any descendant is editable
      return isWithinDocsRoot(entry.path, config) ||
             config.docsRoot.startsWith(entry.path + '/');
    }

    // For files, check if editable
    return isFileEditable(entry.path, config);
  });
}

/**
 * Check if a path matches a glob pattern (simple version)
 */
export function matchGlob(path: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}
