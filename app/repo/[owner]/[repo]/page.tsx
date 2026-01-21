'use client';

import { use, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { FileTree } from '@/components/file-tree';
import { MarkdownEditor } from '@/components/editor/markdown-editor';
import { MarkdownPreview } from '@/components/editor/markdown-preview';
import { WysiwygEditor } from '@/components/editor/wysiwyg-editor';
import { ProposeModal } from '@/components/editor/propose-modal';
import { ProposalStatusBar } from '@/components/editor/proposal-status-bar';
import { ResizableSplit } from '@/components/editor/resizable-split';
import { NewFileModal } from '@/components/editor/new-file-modal';
import { RenameFileModal } from '@/components/editor/rename-file-modal';
import { DeleteFileDialog } from '@/components/editor/delete-file-dialog';
import { AIKickstartPrompt } from '@/components/editor/ai-kickstart-prompt';
import { AIWritingHint } from '@/components/editor/ai-writing-hint';
import { useWritingFriction } from '@/lib/hooks/use-writing-friction';
import { isKickstartEnabled, isAssistEnabled } from '@/lib/ai/feature-flags';
import { UX } from '@/lib/constants/ux-terms';
import { Logo } from '@/components/logo';
import type { DraftStatus, Proposal } from '@/lib/types/api';

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
  isNew?: boolean;
}

export default function RepoPage({ params }: PageProps) {
  const { owner, repo } = use(params);
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
  const [isNewFile, setIsNewFile] = useState(false);

  // File operations state
  const [pendingNewFiles, setPendingNewFiles] = useState<string[]>([]);
  const [pendingDeletedFiles, setPendingDeletedFiles] = useState<string[]>([]);
  const [pendingRenamedFiles, setPendingRenamedFiles] = useState<Map<string, string>>(new Map());
  const [existingFilePaths, _setExistingFilePaths] = useState<string[]>([]);

  // Modal states
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetFolder, setTargetFolder] = useState('');
  const [fileToRename, setFileToRename] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  // Proposal state
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null);

  // AI state
  const [kickstartEnabled] = useState(() => isKickstartEnabled());
  const [assistEnabled] = useState(() => isAssistEnabled());
  const [showKickstart, setShowKickstart] = useState(false);
  // TODO: Wire cursor tracking from editor for better friction detection
  const [cursorLine, _setCursorLine] = useState(0);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Writing friction detector for AI assistance
  const {
    frictionDetected,
    dismissForSession,
    disableGlobally,
    resetFriction,
    markAsShown,
  } = useWritingFriction(content, cursorLine, isNewFile, editorContainerRef);

  // Check for unsaved changes
  const hasUnsavedChanges = status !== 'clean' || pendingNewFiles.length > 0 || pendingDeletedFiles.length > 0 || pendingRenamedFiles.size > 0;

  // Combine all file paths for duplicate checking
  const allFilePaths = useMemo(() => {
    const paths = [...existingFilePaths, ...pendingNewFiles];
    // Add renamed target paths
    pendingRenamedFiles.forEach((newPath) => paths.push(newPath));
    return paths;
  }, [existingFilePaths, pendingNewFiles, pendingRenamedFiles]);

  // Load file content when selected
  useEffect(() => {
    if (!selectedFile) return;

    // If this is a new file, don't fetch from API
    if (pendingNewFiles.includes(selectedFile)) {
      setLoading(true);
      setError(null);

      // Check for saved draft
      const draftKey = `draft:${repoFullName}:${selectedFile}`;
      const savedDraft = localStorage.getItem(draftKey);

      if (savedDraft) {
        try {
          const draft: DraftData = JSON.parse(savedDraft);
          setContent(draft.content);
          setOriginalContent('');
          setOriginalSha('');
          setIsNewFile(true);
          setStatus(draft.content ? 'autosaved' : 'clean');
          setLastSaved(new Date(draft.savedAt));
        } catch {
          setContent('');
          setOriginalContent('');
          setOriginalSha('');
          setIsNewFile(true);
          setStatus('clean');
        }
      } else {
        setContent('');
        setOriginalContent('');
        setOriginalSha('');
        setIsNewFile(true);
        setStatus('clean');
      }

      setLoading(false);
      return;
    }

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
        setIsNewFile(false);

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
  }, [owner, repo, selectedFile, repoFullName, pendingNewFiles]);

  // Handle content changes
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (isNewFile) {
      setStatus(newContent ? 'dirty' : 'clean');
    } else {
      setStatus(newContent === originalContent ? 'clean' : 'dirty');
    }
  }, [originalContent, isNewFile]);

  // Autosave to localStorage
  useEffect(() => {
    if (status !== 'dirty' || !selectedFile) return;

    const timeoutId = setTimeout(() => {
      const key = `draft:${repoFullName}:${selectedFile}`;
      localStorage.setItem(key, JSON.stringify({
        content,
        originalSha,
        savedAt: new Date().toISOString(),
        isNew: isNewFile,
      }));
      setStatus('autosaved');
      setLastSaved(new Date());
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [content, status, repoFullName, selectedFile, originalSha, isNewFile]);

  // Handle file selection with unsaved changes check
  const handleFileSelect = useCallback((path: string) => {
    if (status !== 'clean' && selectedFile) {
      const confirmed = confirm(
        'You have unsaved changes. They are saved locally and you can return to them. Switch files?'
      );
      if (!confirmed) return;
    }
    setSelectedFile(path);
  }, [status, selectedFile]);

  // Handle create new file
  const handleCreateFile = useCallback((folderPath: string) => {
    setTargetFolder(folderPath);
    setShowNewFileModal(true);
  }, []);

  const handleNewFileSuccess = useCallback((path: string) => {
    setPendingNewFiles(prev => [...prev, path]);
    setSelectedFile(path);
    // Initialize empty draft
    const key = `draft:${repoFullName}:${path}`;
    localStorage.setItem(key, JSON.stringify({
      content: '',
      originalSha: '',
      savedAt: new Date().toISOString(),
      isNew: true,
    }));
    // Show AI kickstart prompt for new files
    if (kickstartEnabled) {
      setShowKickstart(true);
    }
  }, [repoFullName, kickstartEnabled]);

  // Handle AI content insertion
  const handleAIInsert = useCallback((aiContent: string) => {
    // Append AI content to current content
    const newContent = content ? `${content}\n\n${aiContent}` : aiContent;
    setContent(newContent);
    setStatus('dirty');
    resetFriction();
  }, [content, resetFriction]);

  // Handle AI kickstart insertion (replaces content for new files)
  const handleKickstartInsert = useCallback((aiContent: string) => {
    setContent(aiContent);
    setStatus('dirty');
    setShowKickstart(false);
    resetFriction();
  }, [resetFriction]);

  // Handle AI hint dismiss
  const handleAIDismiss = useCallback(() => {
    dismissForSession();
  }, [dismissForSession]);

  // Handle AI disable globally
  const handleAIDisableGlobally = useCallback(() => {
    disableGlobally();
  }, [disableGlobally]);

  // Handle kickstart dismiss
  const handleKickstartDismiss = useCallback(() => {
    setShowKickstart(false);
  }, []);

  // Handle rename file
  const handleRenameFile = useCallback((path: string) => {
    setFileToRename(path);
    setShowRenameModal(true);
  }, []);

  const handleRenameSuccess = useCallback((oldPath: string, newPath: string) => {
    const isNewFilePath = pendingNewFiles.includes(oldPath);

    if (isNewFilePath) {
      // For new files, just update the pending list
      setPendingNewFiles(prev => prev.map(p => p === oldPath ? newPath : p));
    } else {
      // For existing files, track the rename
      setPendingRenamedFiles(prev => {
        const updated = new Map(prev);
        updated.set(oldPath, newPath);
        return updated;
      });
    }

    // Move the draft
    const oldKey = `draft:${repoFullName}:${oldPath}`;
    const newKey = `draft:${repoFullName}:${newPath}`;
    const draft = localStorage.getItem(oldKey);
    if (draft) {
      localStorage.setItem(newKey, draft);
      localStorage.removeItem(oldKey);
    }

    // Update selection if the renamed file was selected
    if (selectedFile === oldPath) {
      setSelectedFile(newPath);
    }
  }, [pendingNewFiles, repoFullName, selectedFile]);

  // Handle delete file
  const handleDeleteFile = useCallback((path: string) => {
    setFileToDelete(path);
    setShowDeleteDialog(true);
  }, []);

  const handleDeleteConfirm = useCallback((path: string) => {
    const isNewFilePath = pendingNewFiles.includes(path);

    if (isNewFilePath) {
      // For new files, just remove from pending list
      setPendingNewFiles(prev => prev.filter(p => p !== path));
    } else {
      // For existing files, mark as deleted
      setPendingDeletedFiles(prev => [...prev, path]);
    }

    // Remove the draft
    const key = `draft:${repoFullName}:${path}`;
    localStorage.removeItem(key);

    // Clear selection if deleted file was selected
    if (selectedFile === path) {
      setSelectedFile(null);
      setContent('');
      setOriginalContent('');
      setStatus('clean');
    }
  }, [pendingNewFiles, repoFullName, selectedFile]);

  // Handle propose
  const handlePropose = useCallback(() => {
    if (!hasUnsavedChanges) return;
    setShowProposeModal(true);
  }, [hasUnsavedChanges]);

  // Handle proposal success
  const handleProposalSuccess = useCallback((proposal: Proposal) => {
    setShowProposeModal(false);
    setActiveProposal(proposal);

    // Clear all pending operations
    setPendingNewFiles([]);
    setPendingDeletedFiles([]);
    setPendingRenamedFiles(new Map());

    // Reset editor state
    if (selectedFile) {
      setContent(originalContent);
      setStatus('clean');
      setLastSaved(null);
      setIsNewFile(false);
    }
  }, [originalContent, selectedFile]);

  // Dismiss proposal bar
  const handleDismissProposal = useCallback(() => {
    setActiveProposal(null);
  }, []);

  // Handle discard current file changes
  const handleDiscard = useCallback(() => {
    if (!selectedFile) return;

    if (isNewFile) {
      if (confirm('Are you sure you want to discard this new file?')) {
        setPendingNewFiles(prev => prev.filter(p => p !== selectedFile));
        const key = `draft:${repoFullName}:${selectedFile}`;
        localStorage.removeItem(key);
        setSelectedFile(null);
        setContent('');
        setOriginalContent('');
        setStatus('clean');
        setIsNewFile(false);
      }
    } else {
      if (confirm('Are you sure you want to discard your changes?')) {
        setContent(originalContent);
        setStatus('clean');
        const key = `draft:${repoFullName}:${selectedFile}`;
        localStorage.removeItem(key);
        setLastSaved(null);
      }
    }
  }, [isNewFile, originalContent, repoFullName, selectedFile]);

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

  // Determine if propose button should be enabled
  const canPropose = status !== 'clean' || pendingNewFiles.length > 0 || pendingDeletedFiles.length > 0 || pendingRenamedFiles.size > 0;

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
                {isNewFile && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-600">
                    New
                  </span>
                )}
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
                {/* Editor mode toggle */}
                <div className="flex border border-[var(--border)] rounded overflow-hidden">
                  <EditorModeButton mode="visual" current={editorMode} onClick={setEditorMode} label="Visual" />
                  <EditorModeButton mode="raw" current={editorMode} onClick={setEditorMode} label="Markdown" />
                </div>

                {/* View mode toggles (only for raw mode) */}
                {editorMode === 'raw' && (
                  <div className="flex border border-[var(--border)] rounded overflow-hidden">
                    <ViewModeButton mode="edit" current={viewMode} onClick={setViewMode} label="Edit" />
                    <ViewModeButton mode="split" current={viewMode} onClick={setViewMode} label="Split" />
                    <ViewModeButton mode="preview" current={viewMode} onClick={setViewMode} label="Preview" />
                  </div>
                )}

                {/* Actions */}
                {status !== 'clean' && (
                  <button onClick={handleDiscard} className="btn btn-secondary">
                    {isNewFile ? 'Discard file' : UX.DISCARD_DRAFT}
                  </button>
                )}
              </>
            )}

            <button
              onClick={handlePropose}
              disabled={!canPropose}
              className="btn btn-primary"
            >
              {UX.PROPOSE_CHANGES}
              {(pendingNewFiles.length > 0 || pendingDeletedFiles.length > 0 || pendingRenamedFiles.size > 0) && (
                <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                  {pendingNewFiles.length + pendingDeletedFiles.length + pendingRenamedFiles.size + (status !== 'clean' ? 1 : 0)}
                </span>
              )}
            </button>

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

      {/* Proposal status bar */}
      {activeProposal && (
        <ProposalStatusBar
          proposal={activeProposal}
          onDismiss={handleDismissProposal}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar with file tree */}
        {sidebarOpen && (
          <aside className="w-64 border-r border-[var(--border)] overflow-auto shrink-0">
            <FileTree
              owner={owner}
              repo={repo}
              onFileSelect={handleFileSelect}
              onCreateFile={handleCreateFile}
              onRenameFile={handleRenameFile}
              onDeleteFile={handleDeleteFile}
              selectedPath={selectedFile ?? undefined}
              pendingNewFiles={pendingNewFiles}
              pendingDeletedFiles={pendingDeletedFiles}
              pendingRenamedFiles={pendingRenamedFiles}
            />
          </aside>
        )}

        {/* Editor area */}
        <main className="flex-1 overflow-hidden">
          {!selectedFile ? (
            <EmptyState onCreateFile={() => handleCreateFile('')} />
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
            <div className="h-full flex flex-col relative" ref={editorContainerRef}>
              {/* AI Kickstart Prompt (for new/empty files) */}
              {kickstartEnabled && showKickstart && isNewFile && (
                <AIKickstartPrompt
                  owner={owner}
                  repo={repo}
                  filePath={selectedFile}
                  isNewFile={isNewFile}
                  isEmpty={!content}
                  onInsert={handleKickstartInsert}
                  onDismiss={handleKickstartDismiss}
                />
              )}

              {/* AI Writing Hint (for users showing friction) */}
              {assistEnabled && selectedFile && !showKickstart && (
                <AIWritingHint
                  owner={owner}
                  repo={repo}
                  content={content}
                  show={frictionDetected}
                  onInsert={handleAIInsert}
                  onDismiss={handleAIDismiss}
                  onDisableGlobally={handleAIDisableGlobally}
                  onMarkAsShown={markAsShown}
                />
              )}

              {/* Editor content */}
              <div className="flex-1 flex overflow-hidden">
                {editorMode === 'visual' ? (
                  /* WYSIWYG Editor with resizable preview */
                  <ResizableSplit
                    storageKey="dashdraft-visual-split"
                    defaultLeftWidth={66}
                    minLeftWidth={30}
                    maxLeftWidth={85}
                    left={
                      <WysiwygEditor
                        value={content}
                        onChange={handleChange}
                        placeholder="Start writing..."
                      />
                    }
                    right={
                      <div className="h-full overflow-auto">
                        <MarkdownPreview content={content} />
                      </div>
                    }
                  />
                ) : (
                  /* Raw Markdown Editor */
                  <>
                    {viewMode === 'edit' && (
                      <div className="w-full h-full">
                        <MarkdownEditor
                          value={content}
                          onChange={handleChange}
                        />
                      </div>
                    )}

                    {viewMode === 'split' && (
                      <ResizableSplit
                        storageKey="dashdraft-markdown-split"
                        defaultLeftWidth={50}
                        minLeftWidth={25}
                        maxLeftWidth={75}
                        left={
                          <MarkdownEditor
                            value={content}
                            onChange={handleChange}
                          />
                        }
                        right={
                          <div className="h-full overflow-auto">
                            <MarkdownPreview content={content} />
                          </div>
                        }
                      />
                    )}

                    {viewMode === 'preview' && (
                      <div className="w-full h-full overflow-auto">
                        <MarkdownPreview content={content} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Status bar */}
              <StatusBar
                status={status}
                lastSaved={lastSaved}
                fileName={selectedFile}
                hasChanges={status !== 'clean'}
                isNewFile={isNewFile}
              />
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <NewFileModal
        isOpen={showNewFileModal}
        onClose={() => setShowNewFileModal(false)}
        onSuccess={handleNewFileSuccess}
        targetFolder={targetFolder}
        existingPaths={allFilePaths}
      />

      {fileToRename && (
        <RenameFileModal
          isOpen={showRenameModal}
          onClose={() => {
            setShowRenameModal(false);
            setFileToRename(null);
          }}
          onSuccess={handleRenameSuccess}
          currentPath={fileToRename}
          existingPaths={allFilePaths}
        />
      )}

      {fileToDelete && (
        <DeleteFileDialog
          isOpen={showDeleteDialog}
          onClose={() => {
            setShowDeleteDialog(false);
            setFileToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          filePath={fileToDelete}
          isNewFile={pendingNewFiles.includes(fileToDelete)}
        />
      )}

      <ProposeModal
        isOpen={showProposeModal}
        onClose={() => setShowProposeModal(false)}
        onSuccess={handleProposalSuccess}
        owner={owner}
        repo={repo}
        filePath={selectedFile || ''}
        content={content}
        originalContent={originalContent}
        isNewFile={isNewFile}
        pendingNewFiles={pendingNewFiles}
        pendingDeletedFiles={pendingDeletedFiles}
        pendingRenamedFiles={pendingRenamedFiles}
      />
    </div>
  );
}

function EmptyState({ onCreateFile }: { onCreateFile: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold mb-2">Select a file to edit</h2>
        <p className="text-[var(--muted)] mb-4">
          Choose a Markdown file from the sidebar to start editing,
          or create a new file.
        </p>
        <button onClick={onCreateFile} className="btn btn-primary">
          {UX.NEW_FILE}
        </button>
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

function EditorModeButton({
  mode,
  current,
  onClick,
  label,
}: {
  mode: EditorMode;
  current: EditorMode;
  onClick: (mode: EditorMode) => void;
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

function DraftStatusBadge({
  status,
  lastSaved,
}: {
  status: DraftStatus;
  lastSaved?: Date;
}) {
  if (status === 'clean') return null;

  const getStatusInfo = () => {
    switch (status) {
      case 'dirty':
        return { text: 'Unsaved', className: 'bg-yellow-500/20 text-yellow-600' };
      case 'autosaved':
        return { text: 'Draft saved', className: 'bg-green-500/20 text-green-600' };
      case 'saving':
        return { text: 'Saving...', className: 'bg-blue-500/20 text-blue-600' };
      case 'error':
        return { text: 'Save failed', className: 'bg-red-500/20 text-red-600' };
      default:
        return null;
    }
  };

  const info = getStatusInfo();
  if (!info) return null;

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${info.className}`}>
      {info.text}
      {lastSaved && status === 'autosaved' && (
        <span className="ml-1 opacity-75">
          {formatRelativeTime(lastSaved)}
        </span>
      )}
    </span>
  );
}

function StatusBar({
  status,
  lastSaved,
  fileName,
  hasChanges,
  isNewFile,
}: {
  status: DraftStatus;
  lastSaved: Date | null;
  fileName: string;
  hasChanges: boolean;
  isNewFile: boolean;
}) {
  return (
    <div className="h-8 px-4 flex items-center justify-between border-t border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
      <div className="flex items-center gap-4">
        <span>{fileName}</span>
        {isNewFile && (
          <span className="text-blue-500">New file</span>
        )}
        {hasChanges && !isNewFile && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            Modified
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {status === 'autosaved' && lastSaved && (
          <span>Last saved {formatRelativeTime(lastSaved)}</span>
        )}
        {status === 'dirty' && (
          <span className="text-yellow-600">Unsaved changes</span>
        )}
        {status === 'saving' && (
          <span className="text-blue-600">Saving...</span>
        )}
        {status === 'error' && (
          <span className="text-red-600">Failed to save</span>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else {
    return date.toLocaleDateString();
  }
}
