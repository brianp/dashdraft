/**
 * Changeset Management
 *
 * Creates and manages changesets for proposing changes.
 * A changeset represents all modifications to be submitted as a proposal.
 */

import type { ChangeSet } from '@/lib/types/api';
import type { WorkspaceState } from './state';
import { getModifiedFiles, getNewFiles, getNewAssets } from './state';

// ============================================================================
// Changeset Creation
// ============================================================================

/**
 * Create a changeset from the current workspace state
 */
export function createChangeset(state: WorkspaceState): ChangeSet {
  const modified: Record<string, string> = {};
  const created: Record<string, string> = {};
  const assets: string[] = [];

  // Add modified files
  for (const file of getModifiedFiles(state)) {
    modified[file.path] = file.currentContent;
  }

  // Add new files
  for (const file of getNewFiles(state)) {
    created[file.path] = file.currentContent;
  }

  // Add new assets (paths only - bytes are in IndexedDB)
  for (const asset of getNewAssets(state)) {
    assets.push(asset.path);
  }

  return {
    repoFullName: state.repoFullName,
    modified,
    created,
    deleted: [], // Deletion not yet supported in v1
    assets,
  };
}

// ============================================================================
// Changeset Validation
// ============================================================================

export interface ChangesetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a changeset before submission
 */
export function validateChangeset(changeset: ChangeSet): ChangesetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if there are any changes
  if (isEmptyChangeset(changeset)) {
    errors.push('No changes to propose');
  }

  // Validate file paths
  const allPaths = [
    ...Object.keys(changeset.modified),
    ...Object.keys(changeset.created),
    ...changeset.deleted,
    ...changeset.assets,
  ];

  for (const path of allPaths) {
    if (!isValidPath(path)) {
      errors.push(`Invalid file path: ${path}`);
    }
  }

  // Check for duplicate paths
  const uniquePaths = new Set(allPaths);
  if (uniquePaths.size !== allPaths.length) {
    errors.push('Duplicate file paths detected');
  }

  // Warn about large changesets
  const totalFiles = Object.keys(changeset.modified).length +
                    Object.keys(changeset.created).length +
                    changeset.deleted.length;
  if (totalFiles > 20) {
    warnings.push(`Large changeset with ${totalFiles} files may take longer to process`);
  }

  // Warn about large content
  let totalSize = 0;
  for (const content of Object.values(changeset.modified)) {
    totalSize += content.length;
  }
  for (const content of Object.values(changeset.created)) {
    totalSize += content.length;
  }

  if (totalSize > 1024 * 1024) {
    warnings.push('Large total content size may take longer to process');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if changeset is empty
 */
export function isEmptyChangeset(changeset: ChangeSet): boolean {
  return Object.keys(changeset.modified).length === 0 &&
         Object.keys(changeset.created).length === 0 &&
         changeset.deleted.length === 0 &&
         changeset.assets.length === 0;
}

/**
 * Validate a file path
 */
function isValidPath(path: string): boolean {
  // Check for dangerous patterns
  if (path.includes('..') || path.startsWith('/') || path.includes('\0')) {
    return false;
  }

  // Check for valid characters
  if (!/^[a-zA-Z0-9._\-/]+$/.test(path)) {
    return false;
  }

  return true;
}

// ============================================================================
// Changeset Statistics
// ============================================================================

export interface ChangesetStats {
  modifiedCount: number;
  createdCount: number;
  deletedCount: number;
  assetCount: number;
  totalFiles: number;
  totalContentSize: number;
}

/**
 * Get statistics about a changeset
 */
export function getChangesetStats(changeset: ChangeSet): ChangesetStats {
  const modifiedCount = Object.keys(changeset.modified).length;
  const createdCount = Object.keys(changeset.created).length;
  const deletedCount = changeset.deleted.length;
  const assetCount = changeset.assets.length;

  let totalContentSize = 0;
  for (const content of Object.values(changeset.modified)) {
    totalContentSize += content.length;
  }
  for (const content of Object.values(changeset.created)) {
    totalContentSize += content.length;
  }

  return {
    modifiedCount,
    createdCount,
    deletedCount,
    assetCount,
    totalFiles: modifiedCount + createdCount + deletedCount,
    totalContentSize,
  };
}

// ============================================================================
// Changeset Serialization
// ============================================================================

/**
 * Serialize changeset for API request
 * Note: Asset bytes are fetched separately from IndexedDB
 */
export function serializeChangeset(changeset: ChangeSet): string {
  return JSON.stringify(changeset);
}

/**
 * Deserialize changeset from stored format
 */
export function deserializeChangeset(data: string): ChangeSet | null {
  try {
    const parsed = JSON.parse(data);

    // Validate basic structure
    if (!parsed.repoFullName ||
        typeof parsed.modified !== 'object' ||
        typeof parsed.created !== 'object' ||
        !Array.isArray(parsed.deleted) ||
        !Array.isArray(parsed.assets)) {
      return null;
    }

    return parsed as ChangeSet;
  } catch {
    return null;
  }
}
