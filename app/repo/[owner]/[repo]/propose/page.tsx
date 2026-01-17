'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { UX } from '@/lib/constants/ux-terms';
import type { ChangeSet } from '@/lib/types/api';

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

interface DraftData {
  content: string;
  originalSha: string;
  savedAt: string;
}

export default function ProposePage({ params }: PageProps) {
  const { owner, repo } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const path = searchParams.get('path') || '';
  const repoFullName = `${owner}/${repo}`;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Load draft from localStorage, original from API, and CSRF token
  useEffect(() => {
    if (!path) {
      setError('No file path specified');
      setLoading(false);
      return;
    }

    const key = `draft:${repoFullName}:${path}`;
    const savedDraft = localStorage.getItem(key);

    if (!savedDraft) {
      setError('No draft found. Please edit the file first.');
      setLoading(false);
      return;
    }

    try {
      const draft: DraftData = JSON.parse(savedDraft);
      setDraftContent(draft.content);

      // Generate default title
      const filename = path.split('/').pop() || path;
      setTitle(`Update ${filename}`);

      // Load original content and CSRF token in parallel
      Promise.all([
        fetch(`/api/repo/${owner}/${repo}/file?path=${encodeURIComponent(path)}`),
        fetch('/api/auth/session'),
      ])
        .then(async ([fileRes, sessionRes]) => {
          // Handle file content
          const fileData = await fileRes.json();
          if (fileData.error) {
            setOriginalContent('');
          } else {
            setOriginalContent(fileData.data.content);
          }

          // Get CSRF token from session response header
          const token = sessionRes.headers.get('X-CSRF-Token');
          if (token) {
            setCsrfToken(token);
          }

          setLoading(false);
        })
        .catch(() => {
          setOriginalContent('');
          setLoading(false);
        });
    } catch {
      setError('Failed to load draft');
      setLoading(false);
    }
  }, [path, repoFullName, owner, repo]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setError('Please enter a title for your proposal');
      return;
    }

    if (draftContent === null) {
      setError('No changes to propose');
      return;
    }

    if (!csrfToken) {
      setError('Security token not loaded. Please refresh the page.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build changeset
      const changeset: ChangeSet = {
        repoFullName,
        modified: originalContent !== null ? { [path]: draftContent } : {},
        created: originalContent === null ? { [path]: draftContent } : {},
        deleted: [],
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

      // Clear the draft from localStorage
      const key = `draft:${repoFullName}:${path}`;
      localStorage.removeItem(key);

      // Navigate to proposal page
      router.push(`/repo/${repoFullName}/proposal/${data.data.proposal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, draftContent, originalContent, path, repoFullName, owner, repo, router, csrfToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">{UX.LOADING}</p>
      </div>
    );
  }

  if (error && !draftContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--error)] mb-4">{error}</p>
          <Link href={`/repo/${owner}/${repo}`} className="btn btn-secondary">
            Go back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="card max-w-lg w-full">
        <h1 className="text-xl font-semibold mb-6">{UX.PROPOSE_CHANGES}</h1>

        {error && (
          <div className="mb-4 p-3 bg-[var(--error)]/10 border border-[var(--error)] rounded text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        {/* File being changed */}
        <div className="mb-4 p-3 bg-[var(--border)]/30 rounded">
          <p className="text-sm">
            <span className="font-medium">File:</span> {path}
          </p>
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
          <Link
            href={`/repo/${owner}/${repo}/edit?path=${encodeURIComponent(path)}`}
            className="btn btn-secondary"
          >
            {UX.CANCEL}
          </Link>
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
