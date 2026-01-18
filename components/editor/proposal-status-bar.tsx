'use client';

import { useState, useEffect, useCallback } from 'react';
import { UX } from '@/lib/constants/ux-terms';
import type { Proposal, ProposalStatus } from '@/lib/types/api';

interface ProposalStatusBarProps {
  proposal: Proposal;
  onDismiss?: () => void;
}

const statusConfig: Record<ProposalStatus, {
  bg: string;
  text: string;
  icon: string;
  message: string;
}> = {
  pending: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    text: 'text-blue-400',
    icon: '⏳',
    message: 'Your proposal is awaiting review.',
  },
  approved: {
    bg: 'bg-purple-500/10 border-purple-500/30',
    text: 'text-purple-400',
    icon: '✓',
    message: 'Your proposal has been approved and will be published soon.',
  },
  published: {
    bg: 'bg-green-500/10 border-green-500/30',
    text: 'text-green-400',
    icon: '✓',
    message: 'Your changes have been published!',
  },
  conflict: {
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    text: 'text-yellow-400',
    icon: '⚠',
    message: 'Your proposal has conflicts that need to be resolved.',
  },
  closed: {
    bg: 'bg-gray-500/10 border-gray-500/30',
    text: 'text-gray-400',
    icon: '✕',
    message: 'This proposal was closed.',
  },
};

export function ProposalStatusBar({ proposal, onDismiss }: ProposalStatusBarProps) {
  const [currentProposal, setCurrentProposal] = useState(proposal);
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [owner, repo] = proposal.repoFullName.split('/');
      const response = await fetch(
        `/api/repo/${owner}/${repo}/proposal-status?pr=${proposal.id}`
      );
      const data = await response.json();

      if (!data.error && data.data) {
        setCurrentProposal(data.data);
      }
    } catch {
      // Ignore errors during polling
    }
  }, [proposal.repoFullName, proposal.id]);

  // Poll for updates if pending
  useEffect(() => {
    if (currentProposal.status !== 'pending') {
      setPolling(false);
      return;
    }

    setPolling(true);
    const interval = setInterval(fetchStatus, 15000); // Poll every 15 seconds

    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [currentProposal.status, fetchStatus]);

  const config = statusConfig[currentProposal.status];

  return (
    <div className={`px-4 py-2 border-b ${config.bg} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        <span className={`${config.text}`}>{config.icon}</span>
        <div className="flex items-center gap-2">
          <span className={`font-medium ${config.text}`}>
            {UX.PROPOSAL}: {currentProposal.title}
          </span>
          <span className="text-sm text-[var(--muted)]">
            {config.message}
            {polling && ' Checking...'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={currentProposal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--primary)] hover:underline"
        >
          {UX.VIEW_PROPOSAL} on GitHub
        </a>
        {onDismiss && (currentProposal.status === 'published' || currentProposal.status === 'closed') && (
          <button
            onClick={onDismiss}
            className="ml-2 text-[var(--muted)] hover:text-[var(--foreground)]"
            title="Dismiss"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
