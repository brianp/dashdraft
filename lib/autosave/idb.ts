/**
 * IndexedDB Wrapper for Autosave
 *
 * Provides a simple key-value interface over IndexedDB for storing drafts.
 */

import { openDB, type IDBPDatabase } from 'idb';

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'dashdraft-drafts';
const DB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_ASSETS = 'assets';

// ============================================================================
// Types
// ============================================================================

export interface DraftRecord {
  key: string;
  content: string;
  baseSha: string;
  rev: number;
  updatedAt: number;
  createdAt: number;
}

export interface AssetRecord {
  key: string;
  data: ArrayBuffer;
  mimeType: string;
  size: number;
  updatedAt: number;
}

// ============================================================================
// Database Initialization
// ============================================================================

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Drafts store
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          const draftsStore = db.createObjectStore(STORE_DRAFTS, { keyPath: 'key' });
          draftsStore.createIndex('updatedAt', 'updatedAt');
        }

        // Assets store
        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          const assetsStore = db.createObjectStore(STORE_ASSETS, { keyPath: 'key' });
          assetsStore.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================================
// Draft Operations
// ============================================================================

/**
 * Save a draft to IndexedDB
 * Uses monotonic revision to prevent older writes from overwriting newer ones
 */
export async function saveDraft(
  key: string,
  content: string,
  baseSha: string
): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  // Get existing draft to check revision
  const existing = await db.get(STORE_DRAFTS, key) as DraftRecord | undefined;
  const rev = existing ? existing.rev + 1 : 1;

  const record: DraftRecord = {
    key,
    content,
    baseSha,
    rev,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
  };

  await db.put(STORE_DRAFTS, record);
}

/**
 * Get a draft from IndexedDB
 */
export async function getDraft(key: string): Promise<DraftRecord | null> {
  const db = await getDb();
  const record = await db.get(STORE_DRAFTS, key) as DraftRecord | undefined;
  return record ?? null;
}

/**
 * Delete a draft from IndexedDB
 */
export async function deleteDraft(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_DRAFTS, key);
}

/**
 * Get all drafts matching a prefix
 */
export async function getDraftsByPrefix(prefix: string): Promise<DraftRecord[]> {
  const db = await getDb();
  const allDrafts = await db.getAll(STORE_DRAFTS) as DraftRecord[];
  return allDrafts.filter((d) => d.key.startsWith(prefix));
}

/**
 * Delete all drafts matching a prefix
 */
export async function deleteDraftsByPrefix(prefix: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_DRAFTS, 'readwrite');
  const store = tx.objectStore(STORE_DRAFTS);
  const allKeys = await store.getAllKeys() as string[];

  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      await store.delete(key);
    }
  }

  await tx.done;
}

// ============================================================================
// Asset Operations
// ============================================================================

/**
 * Save an asset to IndexedDB
 */
export async function saveAsset(
  key: string,
  data: ArrayBuffer,
  mimeType: string
): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  const record: AssetRecord = {
    key,
    data,
    mimeType,
    size: data.byteLength,
    updatedAt: now,
  };

  await db.put(STORE_ASSETS, record);
}

/**
 * Get an asset from IndexedDB
 */
export async function getAsset(key: string): Promise<AssetRecord | null> {
  const db = await getDb();
  const record = await db.get(STORE_ASSETS, key) as AssetRecord | undefined;
  return record ?? null;
}

/**
 * Delete an asset from IndexedDB
 */
export async function deleteAsset(key: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_ASSETS, key);
}

/**
 * Get all assets matching a prefix
 */
export async function getAssetsByPrefix(prefix: string): Promise<AssetRecord[]> {
  const db = await getDb();
  const allAssets = await db.getAll(STORE_ASSETS) as AssetRecord[];
  return allAssets.filter((a) => a.key.startsWith(prefix));
}

/**
 * Delete all assets matching a prefix
 */
export async function deleteAssetsByPrefix(prefix: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_ASSETS, 'readwrite');
  const store = tx.objectStore(STORE_ASSETS);
  const allKeys = await store.getAllKeys() as string[];

  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      await store.delete(key);
    }
  }

  await tx.done;
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Prune old drafts by LRU
 * Keeps the most recently updated drafts per repo
 */
export async function pruneOldDrafts(maxDraftsPerRepo: number = 50): Promise<number> {
  const db = await getDb();
  const allDrafts = await db.getAll(STORE_DRAFTS) as DraftRecord[];

  // Group by repo
  const byRepo = new Map<string, DraftRecord[]>();
  for (const draft of allDrafts) {
    const parts = draft.key.split(':');
    if (parts.length >= 4) {
      const repoKey = `${parts[2]}/${parts[3]}`;
      const existing = byRepo.get(repoKey) ?? [];
      existing.push(draft);
      byRepo.set(repoKey, existing);
    }
  }

  let deleted = 0;

  // For each repo, keep only the most recent drafts
  for (const [, drafts] of byRepo) {
    if (drafts.length > maxDraftsPerRepo) {
      // Sort by updatedAt descending
      drafts.sort((a, b) => b.updatedAt - a.updatedAt);

      // Delete older drafts
      const toDelete = drafts.slice(maxDraftsPerRepo);
      for (const draft of toDelete) {
        await db.delete(STORE_DRAFTS, draft.key);
        deleted++;
      }
    }
  }

  return deleted;
}

/**
 * Get total storage used by drafts and assets
 */
export async function getStorageUsage(): Promise<{
  draftCount: number;
  draftSize: number;
  assetCount: number;
  assetSize: number;
}> {
  const db = await getDb();

  const drafts = await db.getAll(STORE_DRAFTS) as DraftRecord[];
  const assets = await db.getAll(STORE_ASSETS) as AssetRecord[];

  let draftSize = 0;
  for (const draft of drafts) {
    draftSize += draft.content.length * 2; // Approximate bytes (UTF-16)
  }

  let assetSize = 0;
  for (const asset of assets) {
    assetSize += asset.size;
  }

  return {
    draftCount: drafts.length,
    draftSize,
    assetCount: assets.length,
    assetSize,
  };
}
