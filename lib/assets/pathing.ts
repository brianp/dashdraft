/**
 * Asset Path Resolution
 *
 * Computes destination paths for uploaded assets and generates
 * relative Markdown image references.
 */

import type { RepoConfig } from '@/lib/types/api';
import { getExtension, getDirectory, joinPath } from '@/lib/path/allow-paths';

// ============================================================================
// Asset Destination
// ============================================================================

/**
 * Compute the destination path for an uploaded asset
 */
export function computeAssetDestination(
  filename: string,
  currentFilePath: string,
  config: RepoConfig
): string {
  const ext = getExtension(filename);
  const baseName = filename.slice(0, -ext.length);

  // Sanitize the filename
  const sanitizedName = sanitizeFilename(baseName);

  // Compute destination directory
  const assetsDir = computeAssetsDir(currentFilePath, config);

  return joinPath(assetsDir, `${sanitizedName}${ext}`);
}

/**
 * Compute the assets directory based on config and current file
 */
function computeAssetsDir(currentFilePath: string, config: RepoConfig): string {
  const currentDir = getDirectory(currentFilePath);

  // If assetsDir is absolute (starts from root), use it directly
  if (config.assetsDir.startsWith('/')) {
    return config.assetsDir.slice(1);
  }

  // If docsRoot is set and currentFile is within it,
  // use assetsDir relative to docsRoot
  if (config.docsRoot && config.docsRoot !== '.') {
    if (currentDir.startsWith(config.docsRoot)) {
      return joinPath(config.docsRoot, config.assetsDir);
    }
  }

  // Default: use assetsDir relative to current file's directory
  return joinPath(currentDir, config.assetsDir);
}

/**
 * Sanitize a filename for use in a path
 */
function sanitizeFilename(name: string): string {
  return name
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove non-alphanumeric characters except hyphens and underscores
    .replace(/[^a-zA-Z0-9\-_]/g, '')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '')
    // Lowercase
    .toLowerCase()
    // Truncate if too long
    .slice(0, 100);
}

// ============================================================================
// Relative Link Generation
// ============================================================================

/**
 * Generate a relative Markdown image link
 */
export function generateImageMarkdown(
  assetPath: string,
  currentFilePath: string,
  altText: string = ''
): string {
  const relativePath = computeRelativePath(assetPath, currentFilePath);
  return `![${altText}](${relativePath})`;
}

/**
 * Compute the relative path from one file to another
 */
export function computeRelativePath(
  targetPath: string,
  fromPath: string
): string {
  const fromDir = getDirectory(fromPath);
  const targetParts = targetPath.split('/');
  const fromParts = fromDir ? fromDir.split('/') : [];

  // Find common prefix
  let commonLength = 0;
  while (
    commonLength < targetParts.length &&
    commonLength < fromParts.length &&
    targetParts[commonLength] === fromParts[commonLength]
  ) {
    commonLength++;
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const upPath = '../'.repeat(upCount);
  const downPath = targetParts.slice(commonLength).join('/');

  const relativePath = upPath + downPath;

  // If empty or doesn't start with ../, prefix with ./
  if (!relativePath || (!relativePath.startsWith('../') && !relativePath.startsWith('./'))) {
    return './' + relativePath;
  }

  return relativePath;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate an asset filename
 */
export function validateAssetFilename(filename: string): {
  valid: boolean;
  error?: string;
} {
  if (!filename) {
    return { valid: false, error: 'Filename is required' };
  }

  const ext = getExtension(filename).toLowerCase();
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File type ${ext} is not allowed. Allowed: ${allowedExtensions.join(', ')}`,
    };
  }

  return { valid: true };
}
