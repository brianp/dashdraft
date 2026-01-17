/**
 * Autosave Key Generation
 *
 * Consistent key generation for storing drafts in IndexedDB.
 */

// ============================================================================
// Key Formats
// ============================================================================

/**
 * Generate a key for a file draft
 */
export function fileDraftKey(repoFullName: string, filePath: string): string {
  return `draft:file:${repoFullName}:${filePath}`;
}

/**
 * Generate a key for an asset draft
 */
export function assetDraftKey(repoFullName: string, assetPath: string): string {
  return `draft:asset:${repoFullName}:${assetPath}`;
}

/**
 * Generate a key for workspace metadata
 */
export function workspaceKey(repoFullName: string): string {
  return `workspace:${repoFullName}`;
}

/**
 * Generate a prefix for all drafts in a repo
 */
export function repoDraftPrefix(repoFullName: string): string {
  return `draft:file:${repoFullName}:`;
}

/**
 * Generate a prefix for all assets in a repo
 */
export function repoAssetPrefix(repoFullName: string): string {
  return `draft:asset:${repoFullName}:`;
}

// ============================================================================
// Key Parsing
// ============================================================================

interface ParsedDraftKey {
  type: 'file' | 'asset' | 'workspace' | 'unknown';
  repoFullName: string;
  path?: string;
}

/**
 * Parse a draft key to extract components
 */
export function parseDraftKey(key: string): ParsedDraftKey {
  const parts = key.split(':');

  if (parts[0] === 'draft' && parts[1] === 'file' && parts.length >= 4) {
    const repoFullName = `${parts[2]}/${parts[3]}`;
    const path = parts.slice(4).join(':');
    return { type: 'file', repoFullName, path };
  }

  if (parts[0] === 'draft' && parts[1] === 'asset' && parts.length >= 4) {
    const repoFullName = `${parts[2]}/${parts[3]}`;
    const path = parts.slice(4).join(':');
    return { type: 'asset', repoFullName, path };
  }

  if (parts[0] === 'workspace' && parts.length >= 3) {
    const repoFullName = `${parts[1]}/${parts[2]}`;
    return { type: 'workspace', repoFullName };
  }

  return { type: 'unknown', repoFullName: '' };
}

// ============================================================================
// Key Validation
// ============================================================================

/**
 * Check if a key is a valid draft key
 */
export function isValidDraftKey(key: string): boolean {
  const parsed = parseDraftKey(key);
  return parsed.type !== 'unknown';
}

/**
 * Check if a key belongs to a specific repo
 */
export function keyBelongsToRepo(key: string, repoFullName: string): boolean {
  const parsed = parseDraftKey(key);
  return parsed.repoFullName === repoFullName;
}
