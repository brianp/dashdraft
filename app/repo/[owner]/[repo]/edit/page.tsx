'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MarkdownEditor } from '@/components/editor/markdown-editor';
import { MarkdownPreview } from '@/components/editor/markdown-preview';
import { DraftStatusBadge } from '@/components/editor/draft-status';
import { UX } from '@/lib/constants/ux-terms';
import type { DraftStatus } from '@/lib/types/api';

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

type ViewMode = 'edit' | 'preview' | 'split';

export default function EditPage({ params }: PageProps) {
  const { owner, repo } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const path = searchParams.get('path') || '';

  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [originalSha, setOriginalSha] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DraftStatus>('clean');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [saving, setSaving] = useState(false);

  const repoFullName = `${owner}/${repo}`;

  // Load file content
  useEffect(() => {
    if (!path) {
      setError('No file path specified');
      setLoading(false);
      return;
    }

    async function loadFile() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/repo/${owner}/${repo}/file?path=${encodeURIComponent(path)}`
        );
        const data = await response.json();

        if (data.error) {
          setError(data.message);
          return;
        }

        setContent(data.data.content);
        setOriginalContent(data.data.content);
        setOriginalSha(data.data.sha);
        setStatus('clean');
      } catch {
        setError('Failed to load file');
      } finally {
        setLoading(false);
      }
    }

    loadFile();
  }, [owner, repo, path]);

  // Handle content changes
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    setStatus(newContent === originalContent ? 'clean' : 'dirty');
  }, [originalContent]);

  // Autosave to localStorage
  useEffect(() => {
    if (status !== 'dirty') return;

    const timeoutId = setTimeout(() => {
      const key = `draft:${repoFullName}:${path}`;
      localStorage.setItem(key, JSON.stringify({
        content,
        originalSha,
        savedAt: new Date().toISOString(),
      }));
      setStatus('autosaved');
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [content, status, repoFullName, path, originalSha]);

  // Handle propose
  const handlePropose = useCallback(async () => {
    if (status === 'clean') return;

    setSaving(true);
    try {
      // Navigate to propose dialog with current changes
      const proposePath = `/repo/${owner}/${repo}/propose?path=${encodeURIComponent(path)}`;
      router.push(proposePath);
    } finally {
      setSaving(false);
    }
  }, [owner, repo, path, status, router]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    if (confirm('Are you sure you want to discard your changes?')) {
      setContent(originalContent);
      setStatus('clean');
      const key = `draft:${repoFullName}:${path}`;
      localStorage.removeItem(key);
    }
  }, [originalContent, repoFullName, path]);

  if (!path) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">{UX.ERROR}</h1>
          <p className="text-[var(--muted)]">No file path specified</p>
          <Link href={`/repo/${owner}/${repo}`} className="btn btn-primary mt-4">
            Go back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)]">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/repo/${owner}/${repo}`}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              &larr; Back
            </Link>
            <span className="font-medium">{path}</span>
            <DraftStatusBadge
              status={status}
              lastSaved={lastSaved ?? undefined}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* View mode toggles */}
            <div className="flex border border-[var(--border)] rounded overflow-hidden">
              <ViewModeButton
                mode="edit"
                current={viewMode}
                onClick={setViewMode}
                label="Edit"
              />
              <ViewModeButton
                mode="split"
                current={viewMode}
                onClick={setViewMode}
                label="Split"
              />
              <ViewModeButton
                mode="preview"
                current={viewMode}
                onClick={setViewMode}
                label="Preview"
              />
            </div>

            {/* Actions */}
            {status !== 'clean' && (
              <button
                onClick={handleDiscard}
                className="btn btn-secondary"
              >
                {UX.DISCARD_DRAFT}
              </button>
            )}
            <button
              onClick={handlePropose}
              disabled={status === 'clean' || saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : UX.PROPOSE_CHANGES}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[var(--muted)]">{UX.LOADING}</p>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-[var(--error)] mb-4">{error}</p>
              <Link href={`/repo/${owner}/${repo}`} className="btn btn-secondary">
                Go back
              </Link>
            </div>
          </div>
        ) : (
          <div className="h-full flex">
            {/* Editor */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <div className={viewMode === 'split' ? 'w-1/2' : 'w-full'}>
                <MarkdownEditor
                  value={content}
                  onChange={handleChange}
                />
              </div>
            )}

            {/* Divider */}
            {viewMode === 'split' && (
              <div className="w-px bg-[var(--border)]" />
            )}

            {/* Preview */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto`}>
                <MarkdownPreview content={content} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function ViewModeButton({
  mode,
  current,
  onClick,
  label,
}: {
  mode: ViewMode;
  current: ViewMode;
  onClick: (mode: ViewMode) => void;
  label: string;
}) {
  const isActive = mode === current;

  return (
    <button
      onClick={() => onClick(mode)}
      className={`px-3 py-1 text-sm ${
        isActive
          ? 'bg-[var(--primary)] text-white'
          : 'bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
      }`}
    >
      {label}
    </button>
  );
}
