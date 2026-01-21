'use client';

import { useState, useCallback, useEffect } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { UX } from '@/lib/constants/ux-terms';

type AssistAction = 'continue' | 'improve' | 'summarize';

interface AIWritingHintProps {
  owner: string;
  repo: string;
  content: string;
  selectedText?: string;
  show: boolean;
  onInsert: (text: string) => void;
  onDismiss: () => void;
  onDisableGlobally: () => void;
  onMarkAsShown: () => void;
}

/**
 * AI Writing Hint
 *
 * A subtle, non-intrusive affordance that appears when friction is detected.
 * Shows once per document per session, offering help without interrupting flow.
 */
export function AIWritingHint({
  owner,
  repo,
  content,
  selectedText,
  show,
  onInsert,
  onDismiss,
  onDisableGlobally,
  onMarkAsShown,
}: AIWritingHintProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeAction, setActiveAction] = useState<AssistAction | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Mark as shown when we actually render
  useEffect(() => {
    if (show) {
      onMarkAsShown();
    }
  }, [show, onMarkAsShown]);

  // Fetch CSRF token on mount
  useEffect(() => {
    if (show) {
      fetch('/api/auth/session')
        .then((res) => {
          const token = res.headers.get('X-CSRF-Token');
          if (token) setCsrfToken(token);
        })
        .catch(() => {});
    }
  }, [show]);

  const {
    completion,
    complete,
    isLoading,
    error,
    stop,
  } = useCompletion({
    api: `/api/repo/${owner}/${repo}/ai/assist`,
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
    streamProtocol: 'text',
    body: {
      assistType: activeAction || 'continue',
    },
    onFinish: () => {
      // Completion finished
    },
    onError: (err) => {
      console.error('[AI Writing Hint] Error:', err);
    },
  });

  const handleAction = useCallback(async (action: AssistAction) => {
    if (!csrfToken) return;

    setActiveAction(action);
    setExpanded(true);

    // Determine what content to send based on action
    let promptContent = content;
    if (action === 'improve' && selectedText) {
      promptContent = `Selected text to improve:\n\n${selectedText}\n\nFull context:\n\n${content}`;
    } else if (action === 'summarize') {
      promptContent = `Please summarize the context so far:\n\n${content}`;
    }

    try {
      await complete(promptContent);
    } catch {
      // Error handled by onError
    }
  }, [csrfToken, content, selectedText, complete]);

  const handleInsert = useCallback(() => {
    if (completion) {
      onInsert(completion);
      onDismiss();
    }
  }, [completion, onInsert, onDismiss]);

  const handleDismiss = useCallback(() => {
    if (isLoading) {
      stop();
    }
    setExpanded(false);
    setActiveAction(null);
    onDismiss();
  }, [isLoading, stop, onDismiss]);

  const handleDontShowAgain = useCallback(() => {
    handleDismiss();
    onDisableGlobally();
  }, [handleDismiss, onDisableGlobally]);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
        {!expanded ? (
          // Collapsed hint
          <div className="p-3">
            <div className="flex items-start gap-3">
              <span className="text-lg" role="img" aria-label="lightbulb">💡</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--foreground)]">
                  {UX.AI_NEED_HELP}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => handleAction('continue')}
                    className="text-xs px-2 py-1 rounded bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
                  >
                    Continue writing
                  </button>
                  {selectedText && (
                    <button
                      onClick={() => handleAction('improve')}
                      className="text-xs px-2 py-1 rounded bg-[var(--border)] hover:bg-[var(--border)]/80 transition-colors"
                    >
                      Improve selection
                    </button>
                  )}
                  <button
                    onClick={() => handleAction('summarize')}
                    className="text-xs px-2 py-1 rounded bg-[var(--border)] hover:bg-[var(--border)]/80 transition-colors"
                  >
                    Summarize context
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={handleDismiss}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Dismiss
                  </button>
                  <span className="text-[var(--muted)]">·</span>
                  <button
                    onClick={handleDontShowAgain}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Don&apos;t show again
                  </button>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shrink-0"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          // Expanded with result
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {activeAction === 'continue' && 'Suggested continuation'}
                {activeAction === 'improve' && 'Suggested improvement'}
                {activeAction === 'summarize' && 'Summary'}
              </span>
              <button
                onClick={handleDismiss}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)] py-2">
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
            )}

            {completion && (
              <div className="text-sm whitespace-pre-wrap bg-[var(--border)]/30 rounded p-2 max-h-48 overflow-auto font-mono mb-2">
                {completion}
              </div>
            )}

            {error && (
              <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 rounded p-2 mb-2">
                {error.message || 'Failed to generate. Please try again.'}
              </div>
            )}

            <div className="flex gap-2">
              {completion && activeAction !== 'summarize' && (
                <button
                  onClick={handleInsert}
                  className="text-xs px-3 py-1.5 rounded bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
                >
                  {UX.AI_INSERT}
                </button>
              )}
              {isLoading && (
                <button
                  onClick={stop}
                  className="text-xs px-3 py-1.5 rounded bg-[var(--border)] hover:bg-[var(--border)]/80 transition-colors"
                >
                  Stop
                </button>
              )}
              <button
                onClick={handleDismiss}
                className="text-xs px-3 py-1.5 rounded bg-[var(--border)] hover:bg-[var(--border)]/80 transition-colors"
              >
                {UX.CLOSE}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
