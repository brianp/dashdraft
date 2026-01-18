'use client';

import { useCallback } from 'react';
import { UX } from '@/lib/constants/ux-terms';

interface DeleteFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (path: string) => void;
  filePath: string;
  isNewFile?: boolean; // If true, file hasn't been committed yet
}

export function DeleteFileDialog({
  isOpen,
  onClose,
  onConfirm,
  filePath,
  isNewFile = false,
}: DeleteFileDialogProps) {
  const handleConfirm = useCallback(() => {
    onConfirm(filePath);
    onClose();
  }, [filePath, onConfirm, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [handleConfirm, onClose]);

  if (!isOpen) return null;

  const filename = filePath.split('/').pop() || filePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">{UX.DELETE_FILE}</h2>

          <p className="mb-4 text-[var(--muted)]">
            {isNewFile ? (
              <>
                Are you sure you want to discard{' '}
                <span className="font-mono text-[var(--foreground)]">{filename}</span>?
                This file hasn&apos;t been submitted yet and will be permanently removed.
              </>
            ) : (
              <>
                Are you sure you want to delete{' '}
                <span className="font-mono text-[var(--foreground)]">{filename}</span>?
                This change will be included in your next proposal.
              </>
            )}
          </p>

          {/* File path */}
          <div className="mb-4 p-2 bg-[var(--border)]/30 rounded font-mono text-sm">
            {filePath}
          </div>

          {!isNewFile && (
            <p className="mb-4 text-sm text-[var(--warning)]">
              The file will be deleted when your proposal is published.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="btn btn-secondary">
              {UX.CANCEL}
            </button>
            <button
              onClick={handleConfirm}
              className="btn bg-[var(--error)] text-white hover:bg-[var(--error)]/90"
              autoFocus
            >
              {isNewFile ? 'Discard' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
