/**
 * Workspace Serialization
 *
 * Serializes workspace state for transmission to the server.
 */

import type { ChangeSet } from '@/lib/types/api';
import type { WorkspaceState } from './state';
import { createChangeset, validateChangeset, getChangesetStats } from './changeset';
import { getAsset } from '@/lib/autosave/idb';
import { assetDraftKey } from '@/lib/autosave/keys';

// ============================================================================
// Serialization
// ============================================================================

export interface SerializedProposal {
  changeset: ChangeSet;
  assetData: Map<string, ArrayBuffer>;
  stats: {
    modifiedCount: number;
    createdCount: number;
    assetCount: number;
    totalSize: number;
  };
}

/**
 * Prepare workspace state for submission
 * Gathers all changes and asset data
 */
export async function serializeForProposal(
  state: WorkspaceState
): Promise<SerializedProposal> {
  const changeset = createChangeset(state);

  // Validate changeset
  const validation = validateChangeset(changeset);
  if (!validation.valid) {
    throw new Error(`Invalid changeset: ${validation.errors.join(', ')}`);
  }

  // Gather asset data from IndexedDB
  const assetData = new Map<string, ArrayBuffer>();

  for (const assetPath of changeset.assets) {
    const key = assetDraftKey(state.repoFullName, assetPath);
    const record = await getAsset(key);

    if (!record) {
      throw new Error(`Asset not found: ${assetPath}`);
    }

    assetData.set(assetPath, record.data);
  }

  // Calculate stats
  const stats = getChangesetStats(changeset);
  let assetSize = 0;
  for (const data of assetData.values()) {
    assetSize += data.byteLength;
  }

  return {
    changeset,
    assetData,
    stats: {
      modifiedCount: stats.modifiedCount,
      createdCount: stats.createdCount,
      assetCount: stats.assetCount,
      totalSize: stats.totalContentSize + assetSize,
    },
  };
}

// ============================================================================
// Changeset Request Body
// ============================================================================

/**
 * Create the request body for the propose API
 */
export function createProposeRequestBody(
  changeset: ChangeSet,
  title: string,
  description: string
): string {
  return JSON.stringify({
    changeset,
    title,
    description,
  });
}

/**
 * Encode asset data as base64 for transmission
 */
export function encodeAssetsForRequest(
  assetData: Map<string, ArrayBuffer>
): Record<string, string> {
  const encoded: Record<string, string> = {};

  for (const [path, data] of assetData) {
    const bytes = new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    encoded[path] = btoa(binary);
  }

  return encoded;
}

// ============================================================================
// Summary Generation
// ============================================================================

/**
 * Generate a human-readable summary of changes
 */
export function generateChangeSummary(changeset: ChangeSet): string {
  const lines: string[] = [];

  const modifiedCount = Object.keys(changeset.modified).length;
  const createdCount = Object.keys(changeset.created).length;
  const deletedCount = changeset.deleted.length;
  const assetCount = changeset.assets.length;

  if (modifiedCount > 0) {
    lines.push(`${modifiedCount} file${modifiedCount === 1 ? '' : 's'} modified`);
  }

  if (createdCount > 0) {
    lines.push(`${createdCount} file${createdCount === 1 ? '' : 's'} created`);
  }

  if (deletedCount > 0) {
    lines.push(`${deletedCount} file${deletedCount === 1 ? '' : 's'} deleted`);
  }

  if (assetCount > 0) {
    lines.push(`${assetCount} image${assetCount === 1 ? '' : 's'} added`);
  }

  return lines.join(', ');
}

/**
 * Generate a list of changed files for display
 */
export function getChangedFilesList(changeset: ChangeSet): string[] {
  return [
    ...Object.keys(changeset.modified).map((p) => `Modified: ${p}`),
    ...Object.keys(changeset.created).map((p) => `Created: ${p}`),
    ...changeset.deleted.map((p) => `Deleted: ${p}`),
    ...changeset.assets.map((p) => `Asset: ${p}`),
  ];
}
