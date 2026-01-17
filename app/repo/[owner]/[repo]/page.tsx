'use client';

import { use, useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileTree } from '@/components/file-tree';
import { MarkdownEditor } from '@/components/editor/markdown-editor';
import { MarkdownPreview } from '@/components/editor/markdown-preview';
import { WysiwygEditor } from '@/components/editor/wysiwyg-editor';
import { UX } from '@/lib/constants/ux-terms';
import { Logo } from '@/components/logo';
import type { DraftStatus } from '@/lib/types/api';

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

type ViewMode = 'edit' | 'preview' | 'split';
type EditorMode = 'visual' | 'raw';

interface DraftData {
  content: string;
  originalSha: string;
  savedAt: string;
}

export default function RepoPage({ params }: PageProps) {
  const { owner, repo } = use(params);
  const router = useRouter();
  const repoFullName = `${owner}/${repo}`;

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Editor state
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [originalSha, setOriginalSha] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DraftStatus>('clean');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');

  // Check for unsaved changes before switching files
  const hasUnsavedChanges = status !== 'clean';

  // Load file content when selected
  useEffect(() => {
    if (!selectedFile) return;

    async function loadFile() {
      try {
        setLoading(true);
        setError(null);

        // Check for saved draft first
        const draftKey = `draft:${repoFullName}:${selectedFile}`;
        const savedDraft = localStorage.getItem(draftKey);

        const response = await fetch(
          `/api/repo/${owner}/${repo}/file?path=${encodeURIComponent(selectedFile!)}`
        );
        const data = await response.json();

        if (data.error) {
          setError(data.message);
          return;
        }

        const serverContent = data.data.content;
        setOriginalContent(serverContent);
        setOriginalSha(data.data.sha);

        // If we have a saved draft, use it
        if (savedDraft) {
          try {
            const draft: DraftData = JSON.parse(savedDraft);
            if (draft.content !== serverContent) {
              setContent(draft.content);
              setStatus('autosaved');
              setLastSaved(new Date(draft.savedAt));
              return;
            }
          } catch {
            // Invalid draft, ignore
          }
        }

        setContent(serverContent);
        setStatus('clean');
        setLastSaved(null);
      } catch {
        setError('Failed to load file');
      } finally {
        setLoading(false);
      }
    }

    loadFile();
  }, [owner, repo, selectedFile, repoFullName]);

  // Handle content changes
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    setStatus(newContent === originalContent ? 'clean' : 'dirty');
  }, [originalContent]);

  // Autosave to localStorage
  useEffect(() => {
    if (status !== 'dirty' || !selectedFile) return;

    const timeoutId = setTimeout(() => {
      const key = `draft:${repoFullName}:${selectedFile}`;
      localStorage.setItem(key, JSON.stringify({
        content,
        originalSha,
        savedAt: new Date().toISOString(),
      }));
      setStatus('autosaved');
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [content, status, repoFullName, selectedFile, originalSha]);

  // Handle file selection with unsaved changes check
  const handleFileSelect = useCallback((path: string) => {
    if (hasUnsavedChanges && selectedFile) {
      const confirmed = confirm(
        'You have unsaved changes. They are saved locally and you can return to them. Switch files?'
      );
      if (!confirmed) return;
    }
    setSelectedFile(path);
  }, [hasUnsavedChanges, selectedFile]);

  // Handle propose
  const handlePropose = useCallback(() => {
    if (status === 'clean' || !selectedFile) return;
    router.push(`/repo/${owner}/${repo}/propose?path=${encodeURIComponent(selectedFile)}`);
  }, [owner, repo, selectedFile, status, router]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    if (!selectedFile) return;
    if (confirm('Are you sure you want to discard your changes?')) {
      setContent(originalContent);
      setStatus('clean');
      const key = `draft:${repoFullName}:${selectedFile}`;
      localStorage.removeItem(key);
      setLastSaved(null);
    }
  }, [originalContent, repoFullName, selectedFile]);

  // Warn before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)] shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-[var(--border)] rounded"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <SidebarIcon />
            </button>
            <Logo size="sm" href="/repos" />
            <span className="text-[var(--muted)]">/</span>
            <span className="font-medium">{repoFullName}</span>
            {selectedFile && (
              <>
                <span className="text-[var(--muted)]">/</span>
                <span className="text-[var(--muted)]">{selectedFile}</span>
                <DraftStatusBadge
                  status={status}
                  lastSaved={lastSaved ?? undefined}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {selectedFile && (
              <>
                {/* View mode toggles */}
                <div className="flex border border-[var(--border)] rounded overflow-hidden">
                  <ViewModeButton mode="edit" current={viewMode} onClick={setViewMode} label="Edit" />
                  <ViewModeButton mode="split" current={viewMode} onClick={setViewMode} label="Split" />
                  <ViewModeButton mode="preview" current={viewMode} onClick={setViewMode} label="Preview" />
                </div>

                {/* Actions */}
                {status !== 'clean' && (
                  <button onClick={handleDiscard} className="btn btn-secondary">
                    {UX.DISCARD_DRAFT}
                  </button>
                )}
                <button
                  onClick={handlePropose}
                  disabled={status === 'clean'}
                  className="btn btn-primary"
                >
                  {UX.PROPOSE_CHANGES}
                </button>
              </>
            )}

            <Link
              href="/repos"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {UX.WORKSPACE}
            </Link>
            <a
              href="/api/auth/logout"
              className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {UX.SIGN_OUT}
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with file tree */}
        {sidebarOpen && (
          <aside className="w-64 border-r border-[var(--border)] overflow-auto shrink-0">
            <div className="p-3 border-b border-[var(--border)]">
              <h2 className="font-semibold text-sm">Files</h2>
            </div>
            <FileTree
              owner={owner}
              repo={repo}
              onFileSelect={handleFileSelect}
              selectedPath={selectedFile ?? undefined}
            />
          </aside>
        )}

        {/* Editor area */}
        <main className="flex-1 overflow-hidden">
          {!selectedFile ? (
            <EmptyState />
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[var(--muted)]">{UX.LOADING}</p>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-[var(--error)] mb-4">{error}</p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="btn btn-secondary"
                >
                  Go back
                </button>
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2">Select a file to edit</h2>
        <p className="text-[var(--muted)]">
          Choose a Markdown file from the sidebar to start editing.
          Your changes will be saved as a {UX.DRAFT.toLowerCase()} until you{' '}
          {UX.PROPOSE_CHANGES.toLowerCase()}.
        </p>
      </div>
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

function SidebarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}
