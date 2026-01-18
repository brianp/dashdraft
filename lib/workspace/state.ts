/**
 * Workspace State Management
 *
 * Manages the state of files being edited in the workspace.
 * Tracks drafts, modified content, and file status.
 */

import type { DraftStatus, FileDraft, RepoConfig } from '@/lib/types/api';

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceState {
  repoFullName: string;
  config: RepoConfig;
  files: Map<string, FileState>;
  assets: Map<string, AssetState>;
  activeFile: string | null;
}

export interface FileState {
  path: string;
  originalContent: string;
  originalSha: string;
  currentContent: string;
  status: DraftStatus;
  lastModified: Date;
  isNew: boolean;
}

export interface AssetState {
  path: string;
  mimeType: string;
  size: number;
  isNew: boolean;
}

// ============================================================================
// Workspace Creation
// ============================================================================

/**
 * Create a new workspace state
 */
export function createWorkspace(repoFullName: string, config: RepoConfig): WorkspaceState {
  return {
    repoFullName,
    config,
    files: new Map(),
    assets: new Map(),
    activeFile: null,
  };
}

// ============================================================================
// File Operations
// ============================================================================

/**
 * Open a file in the workspace
 */
export function openFile(
  state: WorkspaceState,
  path: string,
  content: string,
  sha: string
): WorkspaceState {
  const existingFile = state.files.get(path);

  // If file already open with changes, don't overwrite
  if (existingFile && existingFile.status !== 'clean') {
    return { ...state, activeFile: path };
  }

  const fileState: FileState = {
    path,
    originalContent: content,
    originalSha: sha,
    currentContent: content,
    status: 'clean',
    lastModified: new Date(),
    isNew: false,
  };

  const newFiles = new Map(state.files);
  newFiles.set(path, fileState);

  return {
    ...state,
    files: newFiles,
    activeFile: path,
  };
}

/**
 * Create a new file in the workspace
 */
export function createFile(
  state: WorkspaceState,
  path: string,
  content: string = ''
): WorkspaceState {
  const fileState: FileState = {
    path,
    originalContent: '',
    originalSha: '',
    currentContent: content,
    status: content ? 'dirty' : 'clean',
    lastModified: new Date(),
    isNew: true,
  };

  const newFiles = new Map(state.files);
  newFiles.set(path, fileState);

  return {
    ...state,
    files: newFiles,
    activeFile: path,
  };
}

/**
 * Update file content
 */
export function updateFileContent(
  state: WorkspaceState,
  path: string,
  content: string
): WorkspaceState {
  const file = state.files.get(path);
  if (!file) {
    return state;
  }

  const isDirty = content !== file.originalContent;
  const status: DraftStatus = isDirty ? 'dirty' : 'clean';

  const updatedFile: FileState = {
    ...file,
    currentContent: content,
    status,
    lastModified: new Date(),
  };

  const newFiles = new Map(state.files);
  newFiles.set(path, updatedFile);

  return { ...state, files: newFiles };
}

/**
 * Mark file as autosaved
 */
export function markFileAutosaved(
  state: WorkspaceState,
  path: string
): WorkspaceState {
  const file = state.files.get(path);
  if (!file || file.status !== 'dirty') {
    return state;
  }

  const updatedFile: FileState = {
    ...file,
    status: 'autosaved',
  };

  const newFiles = new Map(state.files);
  newFiles.set(path, updatedFile);

  return { ...state, files: newFiles };
}

/**
 * Close a file
 */
export function closeFile(state: WorkspaceState, path: string): WorkspaceState {
  const newFiles = new Map(state.files);
  newFiles.delete(path);

  return {
    ...state,
    files: newFiles,
    activeFile: state.activeFile === path ? null : state.activeFile,
  };
}

/**
 * Revert file to original content
 */
export function revertFile(state: WorkspaceState, path: string): WorkspaceState {
  const file = state.files.get(path);
  if (!file) {
    return state;
  }

  // If it's a new file, remove it
  if (file.isNew) {
    return closeFile(state, path);
  }

  const revertedFile: FileState = {
    ...file,
    currentContent: file.originalContent,
    status: 'clean',
    lastModified: new Date(),
  };

  const newFiles = new Map(state.files);
  newFiles.set(path, revertedFile);

  return { ...state, files: newFiles };
}

// ============================================================================
// Asset Operations
// ============================================================================

/**
 * Add an asset to the workspace
 */
export function addAsset(
  state: WorkspaceState,
  path: string,
  mimeType: string,
  size: number
): WorkspaceState {
  const assetState: AssetState = {
    path,
    mimeType,
    size,
    isNew: true,
  };

  const newAssets = new Map(state.assets);
  newAssets.set(path, assetState);

  return { ...state, assets: newAssets };
}

/**
 * Remove an asset from the workspace
 */
export function removeAsset(state: WorkspaceState, path: string): WorkspaceState {
  const newAssets = new Map(state.assets);
  newAssets.delete(path);

  return { ...state, assets: newAssets };
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get all modified files
 */
export function getModifiedFiles(state: WorkspaceState): FileState[] {
  return Array.from(state.files.values()).filter(
    (f) => !f.isNew && f.currentContent !== f.originalContent
  );
}

/**
 * Get all new files
 */
export function getNewFiles(state: WorkspaceState): FileState[] {
  return Array.from(state.files.values()).filter((f) => f.isNew);
}

/**
 * Get all new assets
 */
export function getNewAssets(state: WorkspaceState): AssetState[] {
  return Array.from(state.assets.values()).filter((a) => a.isNew);
}

/**
 * Check if workspace has changes
 */
export function hasChanges(state: WorkspaceState): boolean {
  return getModifiedFiles(state).length > 0 ||
         getNewFiles(state).length > 0 ||
         getNewAssets(state).length > 0;
}

/**
 * Get active file state
 */
export function getActiveFile(state: WorkspaceState): FileState | null {
  if (!state.activeFile) {
    return null;
  }
  return state.files.get(state.activeFile) ?? null;
}

// ============================================================================
// Serialization for Draft Storage
// ============================================================================

/**
 * Convert file state to draft for storage
 */
export function fileStateToDraft(file: FileState): FileDraft {
  return {
    path: file.path,
    content: file.currentContent,
    baseVersionId: file.originalSha,
    status: file.status,
    lastModified: file.lastModified.toISOString(),
  };
}

/**
 * Convert draft to file state
 */
export function draftToFileState(
  draft: FileDraft,
  originalContent: string,
  originalSha: string
): FileState {
  return {
    path: draft.path,
    originalContent,
    originalSha,
    currentContent: draft.content,
    status: draft.status,
    lastModified: new Date(draft.lastModified),
    isNew: !originalSha,
  };
}
