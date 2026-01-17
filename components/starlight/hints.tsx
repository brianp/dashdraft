'use client';

import { useState, useEffect } from 'react';
import type { StarlightHints, StarlightHint } from '@/lib/validation/starlight';

interface StarlightHintsDisplayProps {
  owner: string;
  repo: string;
}

export function StarlightHintsDisplay({ owner, repo }: StarlightHintsDisplayProps) {
  const [hints, setHints] = useState<StarlightHints | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed for this repo
    const dismissedKey = `starlight-hints-dismissed:${owner}/${repo}`;
    if (localStorage.getItem(dismissedKey)) {
      setDismissed(true);
      return;
    }

    // Fetch hints
    fetch(`/api/repo/${owner}/${repo}/starlight-hints`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setHints(data.data);
        }
      })
      .catch(() => {
        // Silently fail - hints are optional
      });
  }, [owner, repo]);

  const handleDismiss = () => {
    const dismissedKey = `starlight-hints-dismissed:${owner}/${repo}`;
    localStorage.setItem(dismissedKey, 'true');
    setDismissed(true);
  };

  if (dismissed || !hints || !hints.isLikelyStarlight || hints.hints.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      {hints.hints.map((hint, index) => (
        <HintCard
          key={index}
          hint={hint}
          onDismiss={index === 0 ? handleDismiss : undefined}
        />
      ))}
    </div>
  );
}

interface HintCardProps {
  hint: StarlightHint;
  onDismiss?: () => void;
}

function HintCard({ hint, onDismiss }: HintCardProps) {
  const typeStyles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
    tip: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
  };

  const icons = {
    info: 'ℹ️',
    tip: '💡',
    warning: '⚠️',
  };

  return (
    <div className={`rounded-lg border p-3 mb-2 ${typeStyles[hint.type]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span>{icons[hint.type]}</span>
          <div>
            <p className="font-medium text-sm">{hint.title}</p>
            <p className="text-sm opacity-90 mt-0.5 whitespace-pre-wrap">
              {hint.message}
            </p>
            {hint.learnMoreUrl && (
              <a
                href={hint.learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline hover:no-underline mt-1 inline-block"
              >
                Learn more
              </a>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs opacity-60 hover:opacity-100"
            title="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Inline hint for frontmatter validation
 */
interface FrontmatterHintProps {
  warnings: string[];
}

export function FrontmatterHint({ warnings }: FrontmatterHintProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
      <p className="font-medium mb-1">⚠️ Starlight frontmatter</p>
      <ul className="list-disc list-inside space-y-0.5">
        {warnings.map((warning, i) => (
          <li key={i}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
