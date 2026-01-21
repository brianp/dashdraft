'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { UX } from '@/lib/constants/ux-terms';
import type { AIPanelState } from '@/lib/ai/types';

interface AIAssistantPanelProps {
  owner: string;
  repo: string;
  content: string;
  cursorPosition?: number;
  isStuck: boolean;
  onInsert: (text: string) => void;
  onDismiss: () => void;
}

/**
 * AI Assistant Panel
 *
 * Slides in from the right when the user appears stuck.
 * Offers AI-generated suggestions to help continue writing.
 */
export function AIAssistantPanel({
  owner,
  repo,
  content,
  cursorPosition,
  isStuck,
  onInsert,
  onDismiss,
}: AIAssistantPanelProps) {
  const [panelState, setPanelState] = useState<AIPanelState>('hidden');
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
    api: `/api/repo/${owner}/${repo}/ai/assist`,
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
    body: {
      cursorPosition,
      assistType: 'continue',
    },
  });

  // Show panel when user is stuck (unless dismissed)
  useEffect(() => {
    if (isStuck && !dismissed && panelState === 'hidden') {
      setPanelState('offer');
    } else if (!isStuck && panelState === 'offer') {
      // User started typing again, hide the offer
      setPanelState('hidden');
    }
  }, [isStuck, dismissed, panelState]);

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

  const handleGetSuggestion = useCallback(async () => {
    if (!csrfToken) {
      setPanelState('error');
      return;
    }
    setPanelState('loading');
    try {
      await complete(content);
    } catch {
      setPanelState('error');
    }
  }, [complete, content, csrfToken]);

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

  const handleRetry = useCallback(() => {
    handleGetSuggestion();
  }, [handleGetSuggestion]);

  // Reset dismissed state when content changes significantly
  useEffect(() => {
    if (!dismissed) return;

    // Reset after 2 minutes so user can get help again later
    const timer = setTimeout(() => {
      setDismissed(false);
    }, 120_000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  if (panelState === 'hidden') {
    return null;
  }

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 animate-slide-in-right">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-l-lg shadow-lg w-80 max-h-[60vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-[var(--primary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <span className="font-medium text-sm">{UX.AI_ASSISTANT}</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3">
          {panelState === 'offer' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--muted)]">
                {UX.AI_NEED_HELP} {UX.AI_OFFER_MESSAGE}
              </p>
              <button
                onClick={handleGetSuggestion}
                className="btn btn-primary w-full text-sm"
              >
                {UX.AI_GET_SUGGESTION}
              </button>
            </div>
          )}

          {panelState === 'loading' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                <div className="text-sm whitespace-pre-wrap bg-[var(--border)]/30 rounded p-2 font-mono">
                  {completion}
                </div>
              )}
              <button
                onClick={stop}
                className="btn btn-secondary w-full text-sm"
              >
                Stop
              </button>
            </div>
          )}

          {panelState === 'result' && completion && (
            <div className="space-y-3">
              <div className="text-sm whitespace-pre-wrap bg-[var(--border)]/30 rounded p-2 max-h-48 overflow-auto font-mono">
                {completion}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleInsert}
                  className="btn btn-primary flex-1 text-sm"
                >
                  {UX.AI_INSERT}
                </button>
                <button
                  onClick={handleRetry}
                  className="btn btn-secondary text-sm"
                  title="Generate new suggestion"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {panelState === 'error' && (
            <div className="space-y-3">
              <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 rounded p-2">
                {error?.message || 'Failed to generate suggestion. Please try again.'}
              </div>
              <button
                onClick={handleRetry}
                className="btn btn-primary w-full text-sm"
              >
                {UX.TRY_AGAIN}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
