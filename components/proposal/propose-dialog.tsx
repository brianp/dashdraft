'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UX } from '@/lib/constants/ux-terms';
import type { ChangeSet } from '@/lib/types/api';
import { generateChangeSummary, getChangedFilesList, encodeAssetsForRequest } from '@/lib/workspace/serialize';

interface ProposeDialogProps {
  repoFullName: string;
  changeset: ChangeSet;
  assetData: Map<string, ArrayBuffer>;
  onClose: () => void;
  onSuccess: (proposalUrl: string) => void;
}

export function ProposeDialog({
  repoFullName,
  changeset,
  assetData,
  onClose,
  onSuccess,
}: ProposeDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState(generateDefaultTitle(changeset));
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changedFiles = getChangedFilesList(changeset);
  const summary = generateChangeSummary(changeset);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Please enter a title for your proposal');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Encode assets for transmission
      const encodedAssets = encodeAssetsForRequest(assetData);

      const [owner, repo] = repoFullName.split('/');

      const response = await fetch(`/api/repo/${owner}/${repo}/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changeset,
          title: title.trim(),
          description: description.trim(),
          assets: encodedAssets,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Failed to create proposal');
        return;
      }

      // Success!
      onSuccess(data.data.proposal.url);

      // Navigate to proposal page
      router.push(`/repo/${repoFullName}/proposal/${data.data.proposal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, changeset, assetData, repoFullName, onSuccess, router]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{UX.PROPOSE_CHANGES}</h2>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {UX.CLOSE}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[var(--error)]/10 border border-[var(--error)] rounded text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        {/* Summary */}
        <div className="mb-4 p-3 bg-[var(--border)]/30 rounded">
          <p className="text-sm font-medium mb-2">Changes: {summary}</p>
          <ul className="text-xs text-[var(--muted)] space-y-1 max-h-24 overflow-auto">
            {changedFiles.map((file, i) => (
              <li key={i}>{file}</li>
            ))}
          </ul>
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
          />
        </div>

        {/* Description */}
        <div className="mb-4 flex-1 min-h-0">
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
        <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn btn-secondary"
          >
            {UX.CANCEL}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="btn btn-primary"
          >
            {submitting ? 'Creating...' : UX.SUBMIT_FOR_REVIEW}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate a default title based on the changeset
 */
function generateDefaultTitle(changeset: ChangeSet): string {
  const modifiedPaths = Object.keys(changeset.modified);
  const createdPaths = Object.keys(changeset.created);

  if (createdPaths.length === 1 && modifiedPaths.length === 0) {
    const filename = createdPaths[0]!.split('/').pop();
    return `Add ${filename}`;
  }

  if (modifiedPaths.length === 1 && createdPaths.length === 0) {
    const filename = modifiedPaths[0]!.split('/').pop();
    return `Update ${filename}`;
  }

  const totalFiles = modifiedPaths.length + createdPaths.length;
  return `Update ${totalFiles} files`;
}
