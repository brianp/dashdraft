/**
 * Asset Collision Handling
 *
 * Handles filename collisions when uploading assets.
 */

import { getExtension } from '@/lib/path/allow-paths';

// ============================================================================
// Collision Detection
// ============================================================================

/**
 * Check if a path already exists in the set of existing paths
 */
export function hasCollision(path: string, existingPaths: Set<string>): boolean {
  return existingPaths.has(path);
}

// ============================================================================
// Collision Resolution
// ============================================================================

/**
 * Generate a unique filename by adding a numeric suffix
 */
export function resolveCollision(
  originalPath: string,
  existingPaths: Set<string>
): string {
  if (!hasCollision(originalPath, existingPaths)) {
    return originalPath;
  }

  const ext = getExtension(originalPath);
  const basePath = originalPath.slice(0, -ext.length);

  let counter = 1;
  let newPath = `${basePath}-${counter}${ext}`;

  while (hasCollision(newPath, existingPaths)) {
    counter++;
    newPath = `${basePath}-${counter}${ext}`;

    // Safety limit
    if (counter > 1000) {
      throw new Error('Too many filename collisions');
    }
  }

  return newPath;
}

/**
 * Generate a unique filename using timestamp
 */
export function resolveCollisionWithTimestamp(
  originalPath: string,
  existingPaths: Set<string>
): string {
  if (!hasCollision(originalPath, existingPaths)) {
    return originalPath;
  }

  const ext = getExtension(originalPath);
  const basePath = originalPath.slice(0, -ext.length);
  const timestamp = Date.now();

  const newPath = `${basePath}-${timestamp}${ext}`;

  // If still collides (unlikely), add random suffix
  if (hasCollision(newPath, existingPaths)) {
    const random = Math.random().toString(36).slice(2, 8);
    return `${basePath}-${timestamp}-${random}${ext}`;
  }

  return newPath;
}

// ============================================================================
// Batch Collision Resolution
// ============================================================================

/**
 * Resolve collisions for multiple files
 * Returns a map of original path -> resolved path
 */
export function resolveCollisionsBatch(
  paths: string[],
  existingPaths: Set<string>
): Map<string, string> {
  const result = new Map<string, string>();
  const usedPaths = new Set(existingPaths);

  for (const path of paths) {
    const resolved = resolveCollision(path, usedPaths);
    result.set(path, resolved);
    usedPaths.add(resolved);
  }

  return result;
}
