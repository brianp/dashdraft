'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { UX } from '@/lib/constants/ux-terms';
import type { AIPanelState } from '@/lib/ai/types';

interface AIKickstartPromptProps {
  owner: string;
  repo: string;
  filePath: string;
  isNewFile: boolean;
  isEmpty: boolean;
  onInsert: (content: string) => void;
  onDismiss: () => void;
}

/**
 * AI Kickstart Prompt
 *
 * Shown when creating a new file or opening an empty file.
 * Asks the user what they want to document and generates a structure.
 */
export function AIKickstartPrompt({
  owner,
  repo,
  filePath,
  isNewFile,
  isEmpty,
  onInsert,
  onDismiss,
}: AIKickstartPromptProps) {
  const [panelState, setPanelState] = useState<AIPanelState>('hidden');
  const [summary, setSummary] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Fetch CSRF token on mount
  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => {
        const token = res.headers.get('X-CSRF-Token');
        if (token) setCsrfToken(token);
      })
      .catch(() => {
        // Token fetch failed, will show error on submit
      });
  }, []);

  const {
    completion,
    complete,
    isLoading,
    error,
    stop,
  } = useCompletion({
    api: `/api/repo/${owner}/${repo}/ai/kickstart`,
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
    streamProtocol: 'text',
    body: {
      context: {
        repoName: `${owner}/${repo}`,
        filePath,
      },
    },
    onFinish: () => {
      // Stream finished
    },
    onError: (err) => {
      console.error('[AI Kickstart] Error:', err);
    },
  });

  // Show prompt for new or empty files
  useEffect(() => {
    if ((isNewFile || isEmpty) && !dismissed && panelState === 'hidden') {
      setPanelState('offer');
    }
  }, [isNewFile, isEmpty, dismissed, panelState]);

  // Track loading/result states
  useEffect(() => {
    if (isLoading) {
      setPanelState('loading');
    } else if (error) {
      setPanelState('error');
    } else if (completion) {
      setPanelState('result');
    }
  }, [isLoading, error, completion]);

  const handleSubmit = useCallback(async () => {
    if (!summary.trim()) return;
    if (!csrfToken) {
      setPanelState('error');
      return;
    }
    setPanelState('loading');
    try {
      await complete(summary);
    } catch {
      setPanelState('error');
    }
  }, [complete, summary, csrfToken]);

  const handleInsert = useCallback(() => {
    if (completion) {
      onInsert(completion);
      setPanelState('hidden');
      setDismissed(true);
    }
  }, [completion, onInsert]);

  const handleDismiss = useCallback(() => {
    if (isLoading) {
      stop();
    }
    setPanelState('hidden');
    setDismissed(true);
    onDismiss();
  }, [isLoading, stop, onDismiss]);

  const handleStartOver = useCallback(() => {
    setSummary('');
    setPanelState('input');
  }, []);

  const handleStartWriting = useCallback(() => {
    setPanelState('input');
  }, []);

  const handleWriteManually = useCallback(() => {
    setDismissed(true);
    setPanelState('hidden');
    onDismiss();
  }, [onDismiss]);

  if (panelState === 'hidden') {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--background)]/90 backdrop-blur-sm">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-[var(--primary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span className="font-semibold">{UX.AI_NEW_DOC_TITLE}</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {panelState === 'offer' && (
            <div className="space-y-4">
              <p className="text-[var(--muted)]">
                {UX.AI_NEW_DOC_MESSAGE}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleStartWriting}
                  className="btn btn-primary flex-1"
                >
                  {UX.AI_HELP_START}
                </button>
                <button
                  onClick={handleWriteManually}
                  className="btn btn-secondary flex-1"
                >
                  {UX.AI_WRITE_SCRATCH}
                </button>
              </div>
            </div>
          )}

          {panelState === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {UX.AI_WHAT_TO_DOCUMENT}
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g., API reference for our authentication endpoints, Getting started guide for new developers, Architecture overview of the payment system..."
                  className="w-full h-28 p-3 border border-[var(--border)] rounded-md bg-[var(--background)] focus:outline-none focus:border-[var(--primary)] resize-none text-sm"
                  autoFocus
                  maxLength={500}
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  {summary.length}/500 characters
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={!summary.trim() || summary.trim().length < 10}
                  className="btn btn-primary flex-1"
                >
                  {UX.AI_GENERATE_OUTLINE}
                </button>
                <button
                  onClick={handleWriteManually}
                  className="btn btn-secondary"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {panelState === 'loading' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[var(--muted)]">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>{UX.AI_GENERATING}</span>
              </div>
              {completion && (
                <div className="text-sm whitespace-pre-wrap bg-[var(--border)]/30 rounded-md p-3 max-h-64 overflow-auto font-mono">
                  {completion}
                </div>
              )}
              <button
                onClick={stop}
                className="btn btn-secondary w-full"
              >
                {UX.CANCEL}
              </button>
            </div>
          )}

          {panelState === 'result' && completion && (
            <div className="space-y-4">
              <div className="text-sm whitespace-pre-wrap bg-[var(--border)]/30 rounded-md p-3 max-h-64 overflow-auto font-mono">
                {completion}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleInsert}
                  className="btn btn-primary flex-1"
                >
                  {UX.AI_USE_OUTLINE}
                </button>
                <button
                  onClick={handleStartOver}
                  className="btn btn-secondary"
                  title="Try a different description"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Try again
                </button>
              </div>
            </div>
          )}

          {panelState === 'error' && (
            <div className="space-y-4">
              <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 rounded-md p-3">
                {error?.message || 'Failed to generate document structure. Please try again.'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleStartOver}
                  className="btn btn-primary flex-1"
                >
                  {UX.TRY_AGAIN}
                </button>
                <button
                  onClick={handleWriteManually}
                  className="btn btn-secondary"
                >
                  {UX.AI_WRITE_SCRATCH}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
