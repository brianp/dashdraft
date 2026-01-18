'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { UX } from '@/lib/constants/ux-terms';
import type { ChangeSet, Proposal } from '@/lib/types/api';

interface ProposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (proposal: Proposal) => void;
  owner: string;
  repo: string;
  filePath: string;
  content: string;
  originalContent: string;
  isNewFile?: boolean;
  pendingNewFiles?: string[];
  pendingDeletedFiles?: string[];
  pendingRenamedFiles?: Map<string, string>;
}

interface DraftData {
  content: string;
  originalSha: string;
  savedAt: string;
  isNew?: boolean;
}

// Helper to get draft from localStorage
function getDraft(repoFullName: string, path: string): DraftData | null {
  try {
    const key = `draft:${repoFullName}:${path}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function ProposeModal({
  isOpen,
  onClose,
  onSuccess,
  owner,
  repo,
  filePath,
  content,
  originalContent,
  isNewFile = false,
  pendingNewFiles = [],
  pendingDeletedFiles = [],
  pendingRenamedFiles = new Map(),
}: ProposeModalProps) {
  const repoFullName = `${owner}/${repo}`;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Compute summary of all changes
  const changesSummary = useMemo(() => {
    const created: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [...pendingDeletedFiles];
    const renamed: Array<{ from: string; to: string }> = [];

    // Collect renamed file paths to avoid double-counting
    const renamedNewPaths = new Set<string>();
    const renamedOldPaths = new Set<string>();

    // Add renamed files
    pendingRenamedFiles.forEach((newPath, oldPath) => {
      renamed.push({ from: oldPath, to: newPath });
      renamedNewPaths.add(newPath);
      renamedOldPaths.add(oldPath);
    });

    // Current file being edited
    if (filePath) {
      // Skip if this is a renamed file (already tracked in renamed)
      const isRenamedFile = renamedNewPaths.has(filePath) || renamedOldPaths.has(filePath);

      if (!isRenamedFile) {
        if (isNewFile || pendingNewFiles.includes(filePath)) {
          // New file - only count as created, not modified
          if (!created.includes(filePath)) created.push(filePath);
        } else if (content !== originalContent) {
          // Existing file with changes
          if (!modified.includes(filePath)) modified.push(filePath);
        }
      }
    }

    // Other new files from pendingNewFiles
    pendingNewFiles.forEach((path) => {
      if (path !== filePath && !created.includes(path) && !renamedNewPaths.has(path)) {
        created.push(path);
      }
    });

    return { created, modified, deleted, renamed };
  }, [filePath, content, originalContent, isNewFile, pendingNewFiles, pendingDeletedFiles, pendingRenamedFiles]);

  // Check if there are any changes
  const hasChanges = useMemo(() => {
    return (
      changesSummary.created.length > 0 ||
      changesSummary.modified.length > 0 ||
      changesSummary.deleted.length > 0 ||
      changesSummary.renamed.length > 0
    );
  }, [changesSummary]);

  // Generate default title and fetch CSRF token when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Generate smart title based on changes
    const { created, modified, deleted, renamed } = changesSummary;
    const parts: string[] = [];

    const getFilename = (path: string) => path.split('/').pop() || path;

    if (created.length === 1 && created[0]) {
      parts.push(`Add ${getFilename(created[0])}`);
    } else if (created.length > 1) {
      parts.push(`Add ${created.length} files`);
    }

    if (modified.length === 1 && modified[0]) {
      parts.push(`Update ${getFilename(modified[0])}`);
    } else if (modified.length > 1) {
      parts.push(`Update ${modified.length} files`);
    }

    if (deleted.length === 1 && deleted[0]) {
      parts.push(`Delete ${getFilename(deleted[0])}`);
    } else if (deleted.length > 1) {
      parts.push(`Delete ${deleted.length} files`);
    }

    if (renamed.length === 1 && renamed[0]) {
      parts.push(`Rename ${getFilename(renamed[0].from)}`);
    } else if (renamed.length > 1) {
      parts.push(`Rename ${renamed.length} files`);
    }

    setTitle(parts.join(', ') || 'Update documentation');
    setError(null);

    // Fetch CSRF token
    fetch('/api/auth/session')
      .then((res) => {
        const token = res.headers.get('X-CSRF-Token');
        if (token) setCsrfToken(token);
      })
      .catch(() => {
        // Token will be null, we'll show an error on submit
      });
  }, [isOpen, changesSummary]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Please enter a title for your proposal');
      return;
    }

    if (!csrfToken) {
      setError('Security token not loaded. Please try again.');
      return;
    }

    if (!hasChanges) {
      setError('No changes to submit');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build the complete changeset
      const created: Record<string, string> = {};
      const modified: Record<string, string> = {};
      const deleted: string[] = [...changesSummary.deleted];

      // Handle current file
      if (filePath) {
        if (isNewFile || pendingNewFiles.includes(filePath)) {
          created[filePath] = content;
        } else if (content !== originalContent) {
          modified[filePath] = content;
        }
      }

      // Add other new files from localStorage
      pendingNewFiles.forEach((path) => {
        if (path === filePath) return;
        const draft = getDraft(repoFullName, path);
        if (draft) {
          created[path] = draft.content;
        }
      });

      // Handle renamed files - treat as delete old + create new
      // Use for...of to allow async fetching if needed
      for (const [oldPath, newPath] of pendingRenamedFiles.entries()) {
        // Delete old path if not already in deleted
        if (!deleted.includes(oldPath)) {
          deleted.push(oldPath);
        }

        // Get the content for the renamed file
        // Priority: 1) current editor content if this file is selected
        //           2) draft at new path
        //           3) draft at old path (fallback)
        //           4) fetch from server (for files never loaded/edited)
        let fileContent: string | null = null;

        if (filePath === newPath) {
          // This renamed file is currently selected in the editor
          fileContent = content;
        } else {
          // Try to get draft from localStorage
          const draftNew = getDraft(repoFullName, newPath);
          if (draftNew) {
            fileContent = draftNew.content;
          } else {
            // Fallback: try old path in case draft wasn't moved
            const draftOld = getDraft(repoFullName, oldPath);
            if (draftOld) {
              fileContent = draftOld.content;
            }
          }
        }

        // If still no content, fetch from server using old path
        if (fileContent === null) {
          try {
            const response = await fetch(
              `/api/repo/${owner}/${repo}/file?path=${encodeURIComponent(oldPath)}`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.data?.content !== undefined) {
                fileContent = data.data.content;
              }
            }
          } catch {
            // Failed to fetch - file might not exist or other error
            console.warn(`Could not fetch content for renamed file: ${oldPath}`);
          }
        }

        if (fileContent !== null) {
          created[newPath] = fileContent;
        }
      }

      const changeset: ChangeSet = {
        repoFullName,
        modified,
        created,
        deleted,
        assets: [],
      };

      const response = await fetch(`/api/repo/${owner}/${repo}/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          changeset,
          title: title.trim(),
          description: description.trim(),
          assets: {},
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to create proposal');
        return;
      }

      // Clear all drafts from localStorage
      const draftsToClear = new Set<string>();
      if (filePath) draftsToClear.add(filePath);
      pendingNewFiles.forEach((path) => draftsToClear.add(path));
      pendingRenamedFiles.forEach((newPath, oldPath) => {
        draftsToClear.add(oldPath);
        draftsToClear.add(newPath);
      });

      draftsToClear.forEach((path) => {
        const key = `draft:${repoFullName}:${path}`;
        localStorage.removeItem(key);
      });

      // Call success handler with proposal data
      onSuccess(data.data.proposal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, content, originalContent, filePath, repoFullName, owner, repo, csrfToken, onSuccess, hasChanges, changesSummary, isNewFile, pendingNewFiles, pendingRenamedFiles]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  }, [submitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">{UX.PROPOSE_CHANGES}</h2>

          {error && (
            <div className="mb-4 p-3 bg-[var(--error)]/10 border border-[var(--error)] rounded text-sm text-[var(--error)]">
              {error}
            </div>
          )}

          {/* Changes summary */}
          <div className="mb-4 p-3 bg-[var(--border)]/30 rounded text-sm space-y-2">
            <p className="font-medium mb-2">Changes to submit:</p>

            {changesSummary.created.length > 0 && (
              <div>
                <span className="text-[var(--success)] font-medium">+ New files:</span>
                <ul className="ml-4 mt-1 space-y-0.5">
                  {changesSummary.created.map((path) => (
                    <li key={path} className="font-mono text-xs">{path}</li>
                  ))}
                </ul>
              </div>
            )}

            {changesSummary.modified.length > 0 && (
              <div>
                <span className="text-[var(--warning)] font-medium">~ Modified files:</span>
                <ul className="ml-4 mt-1 space-y-0.5">
                  {changesSummary.modified.map((path) => (
                    <li key={path} className="font-mono text-xs">{path}</li>
                  ))}
                </ul>
              </div>
            )}

            {changesSummary.deleted.length > 0 && (
              <div>
                <span className="text-[var(--error)] font-medium">- Deleted files:</span>
                <ul className="ml-4 mt-1 space-y-0.5">
                  {changesSummary.deleted.map((path) => (
                    <li key={path} className="font-mono text-xs">{path}</li>
                  ))}
                </ul>
              </div>
            )}

            {changesSummary.renamed.length > 0 && (
              <div>
                <span className="text-[var(--primary)] font-medium">→ Renamed files:</span>
                <ul className="ml-4 mt-1 space-y-0.5">
                  {changesSummary.renamed.map(({ from, to }) => (
                    <li key={from} className="font-mono text-xs">
                      {from} → {to}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!hasChanges && (
              <p className="text-[var(--muted)]">No changes detected</p>
            )}
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              placeholder="Describe your changes..."
              className="w-full p-2 border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]"
              maxLength={256}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              placeholder="Add more context about your changes..."
              className="w-full h-32 p-2 border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:border-[var(--primary)] resize-none"
              maxLength={65536}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              disabled={submitting}
              className="btn btn-secondary"
            >
              {UX.CANCEL}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !hasChanges}
              className="btn btn-primary"
            >
              {submitting ? 'Creating...' : UX.SUBMIT_FOR_REVIEW}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
