/**
 * Autosave Policy
 *
 * Defines when and how drafts should be saved.
 */

// ============================================================================
// Configuration
// ============================================================================

export const AUTOSAVE_CONFIG = {
  /** Debounce delay after typing stops (ms) */
  debounceDelay: 500,

  /** Interval for periodic safety flush (ms) */
  flushInterval: 10000,

  /** Maximum drafts to keep per repo */
  maxDraftsPerRepo: 50,

  /** Maximum asset size (bytes) */
  maxAssetSize: 5 * 1024 * 1024,

  /** Maximum total storage (bytes) - warn user when approaching */
  storageWarningThreshold: 50 * 1024 * 1024,

  /** Stale draft threshold (ms) - drafts older than this may be pruned */
  staleDraftThreshold: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ============================================================================
// Autosave Hook Types
// ============================================================================

export interface AutosaveCallbacks {
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

// ============================================================================
// Debounce Utility
// ============================================================================

/**
 * Create a debounced function that delays execution
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Create a throttled function that limits execution frequency
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRun >= limit) {
      fn(...args);
      lastRun = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        fn(...args);
        lastRun = Date.now();
        timeoutId = null;
      }, limit - (now - lastRun));
    }
  };
}

// ============================================================================
// Visibility Change Handling
// ============================================================================

/**
 * Register a callback to run when the page becomes hidden
 * Useful for saving drafts before the user leaves
 */
export function onVisibilityHidden(callback: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === 'hidden') {
      callback();
    }
  };

  document.addEventListener('visibilitychange', handler);

  return () => {
    document.removeEventListener('visibilitychange', handler);
  };
}

/**
 * Register a callback to run before the page unloads
 * Note: This is best-effort and may not always complete
 */
export function onBeforeUnload(callback: () => void): () => void {
  const handler = () => {
    callback();
  };

  window.addEventListener('beforeunload', handler);

  return () => {
    window.removeEventListener('beforeunload', handler);
  };
}

// ============================================================================
// Draft Restoration Check
// ============================================================================

export interface DraftRestorePrompt {
  path: string;
  savedAt: Date;
  hasChanges: boolean;
}

/**
 * Check if there's a draft that should be restored
 */
export function shouldPromptRestore(
  savedAt: number,
  originalSha: string,
  currentSha: string
): boolean {
  // Don't restore if the file has changed on the server
  if (originalSha !== currentSha) {
    return false;
  }

  // Don't restore drafts older than the stale threshold
  const age = Date.now() - savedAt;
  if (age > AUTOSAVE_CONFIG.staleDraftThreshold) {
    return false;
  }

  return true;
}
