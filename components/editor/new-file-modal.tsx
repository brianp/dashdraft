'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { UX } from '@/lib/constants/ux-terms';

interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (path: string) => void;
  targetFolder: string;
  existingPaths: string[];
  allowedExtensions?: string[];
}

const SAFE_FILENAME_CHARS = /^[a-zA-Z0-9._-]+$/;
const DEFAULT_EXTENSIONS = ['.md', '.mdx'];

export function NewFileModal({
  isOpen,
  onClose,
  onSuccess,
  targetFolder,
  existingPaths,
  allowedExtensions = DEFAULT_EXTENSIONS,
}: NewFileModalProps) {
  const [filename, setFilename] = useState('');
  const [extension, setExtension] = useState(allowedExtensions[0] || '.md');
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFilename('');
      setExtension(allowedExtensions[0] || '.md');
      setError(null);
    }
  }, [isOpen, allowedExtensions]);

  // Compute full path
  const fullPath = useMemo(() => {
    if (!filename) return '';
    const name = filename.endsWith(extension) ? filename : `${filename}${extension}`;
    return targetFolder ? `${targetFolder}/${name}` : name;
  }, [filename, extension, targetFolder]);

  // Validate filename
  const validateFilename = useCallback((name: string): string | null => {
    if (!name.trim()) {
      return 'Please enter a filename';
    }

    // Remove extension if user typed it
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

    // Check for duplicates (case-insensitive)
    const checkPath = targetFolder
      ? `${targetFolder}/${baseName}`
      : baseName;

    const lowerPath = checkPath.toLowerCase();
    for (const ext of allowedExtensions) {
      const fullCheckPath = `${lowerPath}${ext.toLowerCase()}`;
      if (existingPaths.some(p => p.toLowerCase() === fullCheckPath)) {
        return 'A file with this name already exists';
      }
    }

    return null;
  }, [targetFolder, existingPaths, allowedExtensions]);

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

    onSuccess(fullPath);
    onClose();
  }, [filename, fullPath, validateFilename, onSuccess, onClose]);

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
          <h2 className="text-xl font-semibold mb-4">{UX.NEW_FILE}</h2>

          {/* Target folder info */}
          {targetFolder && (
            <div className="mb-4 text-sm text-[var(--muted)]">
              Creating in: <span className="font-mono">{targetFolder}/</span>
            </div>
          )}

          {/* Filename input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Filename</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="my-document"
                className="flex-1 p-2 border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]"
                autoFocus
              />
              <select
                value={extension}
                onChange={(e) => setExtension(e.target.value)}
                className="p-2 border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:border-[var(--primary)]"
              >
                {allowedExtensions.map((ext) => (
                  <option key={ext} value={ext}>{ext}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview path */}
          {fullPath && (
            <div className="mb-4 p-2 bg-[var(--border)]/30 rounded font-mono text-sm">
              {fullPath}
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
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
