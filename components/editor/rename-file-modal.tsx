'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { UX } from '@/lib/constants/ux-terms';

interface RenameFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (oldPath: string, newPath: string) => void;
  currentPath: string;
  existingPaths: string[];
  allowedExtensions?: string[];
}

const SAFE_FILENAME_CHARS = /^[a-zA-Z0-9._-]+$/;
const DEFAULT_EXTENSIONS = ['.md', '.mdx'];

export function RenameFileModal({
  isOpen,
  onClose,
  onSuccess,
  currentPath,
  existingPaths,
  allowedExtensions = DEFAULT_EXTENSIONS,
}: RenameFileModalProps) {
  const [filename, setFilename] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Extract folder and current filename
  const folder = useMemo(() => {
    const lastSlash = currentPath.lastIndexOf('/');
    return lastSlash >= 0 ? currentPath.slice(0, lastSlash) : '';
  }, [currentPath]);

  const currentFilename = useMemo(() => {
    const lastSlash = currentPath.lastIndexOf('/');
    return lastSlash >= 0 ? currentPath.slice(lastSlash + 1) : currentPath;
  }, [currentPath]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFilename(currentFilename);
      setError(null);
    }
  }, [isOpen, currentFilename]);

  // Compute new full path
  const newPath = useMemo(() => {
    if (!filename) return '';
    return folder ? `${folder}/${filename}` : filename;
  }, [filename, folder]);

  // Validate filename
  const validateFilename = useCallback((name: string): string | null => {
    if (!name.trim()) {
      return 'Please enter a filename';
    }

    // Check extension
    const hasValidExtension = allowedExtensions.some(ext =>
      name.toLowerCase().endsWith(ext.toLowerCase())
    );
    if (!hasValidExtension) {
      return `Filename must end with ${allowedExtensions.join(' or ')}`;
    }

    // Get base name without extension
    const baseName = name.replace(/\.(md|mdx)$/i, '');

    if (!SAFE_FILENAME_CHARS.test(baseName)) {
      return 'Filename can only contain letters, numbers, dots, dashes, and underscores';
    }

    if (baseName.startsWith('.') || baseName.startsWith('-')) {
      return 'Filename cannot start with a dot or dash';
    }

    if (baseName.length > 100) {
      return 'Filename is too long (max 100 characters)';
    }

    // Check if unchanged
    if (name === currentFilename) {
      return null; // Allow submitting same name (no-op)
    }

    // Check for duplicates (case-insensitive)
    const checkPath = folder ? `${folder}/${name}` : name;
    const lowerPath = checkPath.toLowerCase();

    // Exclude current path from duplicate check
    const otherPaths = existingPaths.filter(p => p !== currentPath);
    if (otherPaths.some(p => p.toLowerCase() === lowerPath)) {
      return 'A file with this name already exists';
    }

    return null;
  }, [folder, currentFilename, currentPath, existingPaths, allowedExtensions]);

  // Real-time validation
  useEffect(() => {
    if (filename) {
      setError(validateFilename(filename));
    } else {
      setError(null);
    }
  }, [filename, validateFilename]);

  const handleSubmit = useCallback(() => {
    const validationError = validateFilename(filename);
    if (validationError) {
      setError(validationError);
      return;
    }

    // If name unchanged, just close
    if (filename === currentFilename) {
      onClose();
      return;
    }

    onSuccess(currentPath, newPath);
    onClose();
  }, [filename, currentFilename, currentPath, newPath, validateFilename, onSuccess, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !error && filename.trim()) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [error, filename, handleSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">{UX.RENAME_FILE}</h2>

          {/* Current file info */}
          <div className="mb-4 text-sm text-[var(--muted)]">
            Current: <span className="font-mono">{currentPath}</span>
          </div>

          {/* Filename input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">New filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="new-name.md"
              className="w-full p-2 border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]"
              autoFocus
            />
          </div>

          {/* Preview new path */}
          {newPath && newPath !== currentPath && (
            <div className="mb-4 p-2 bg-[var(--border)]/30 rounded font-mono text-sm">
              New path: {newPath}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-2 bg-[var(--error)]/10 border border-[var(--error)] rounded text-sm text-[var(--error)]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="btn btn-secondary">
              {UX.CANCEL}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!filename.trim() || !!error}
              className="btn btn-primary"
            >
              Rename
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
