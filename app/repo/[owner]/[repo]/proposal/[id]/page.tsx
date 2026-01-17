'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { StatusBadge, StatusDisplay } from '@/components/proposal/status-badge';
import { UX } from '@/lib/constants/ux-terms';
import { getConflictGuidance } from '@/lib/constants/conflict-guidance';
import type { Proposal } from '@/lib/types/api';

interface PageProps {
  params: Promise<{
    owner: string;
    repo: string;
    id: string;
  }>;
}

export default function ProposalPage({ params }: PageProps) {
  const { owner, repo, id } = use(params);
  const repoFullName = `${owner}/${repo}`;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchProposal = useCallback(async () => {
    try {
      // We need PR number to fetch status
      // For now, we'll assume id is the PR number or fetch from our DB
      const response = await fetch(
        `/api/repo/${owner}/${repo}/proposal-status?pr=${id}`
      );
      const data = await response.json();

      if (data.error) {
        setError(data.message);
        return;
      }

      setProposal(data.data);
    } catch {
      setError('Failed to load proposal');
    } finally {
      setLoading(false);
    }
  }, [owner, repo, id]);

  // Initial load
  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  // Poll for status updates if pending
  useEffect(() => {
    if (!proposal || proposal.status !== 'pending') {
      return;
    }

    setPolling(true);
    const interval = setInterval(fetchProposal, 10000); // Poll every 10 seconds

    // Stop polling after 60 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPolling(false);
    }, 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      setPolling(false);
    };
  }, [proposal?.status, fetchProposal]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header repoFullName={repoFullName} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-[var(--muted)]">{UX.LOADING}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen">
        <Header repoFullName={repoFullName} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="card text-center py-12">
            <p className="text-[var(--error)] mb-4">{error || 'Proposal not found'}</p>
            <Link href={`/repo/${repoFullName}`} className="btn btn-secondary">
              Back to workspace
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header repoFullName={repoFullName} />

      <main className="max-w-2xl mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{proposal.title}</h1>
            <StatusBadge status={proposal.status} />
          </div>
          <p className="text-sm text-[var(--muted)]">
            Created {formatDate(proposal.createdAt)}
          </p>
        </div>

        {/* Status details */}
        <div className="mb-6">
          {proposal.status === 'conflict' ? (
            <ConflictMessage prUrl={proposal.url} />
          ) : proposal.status === 'published' ? (
            <StatusDisplay
              status="published"
              message="Your changes have been published and are now live."
            />
          ) : proposal.status === 'closed' ? (
            <StatusDisplay
              status="closed"
              message="This proposal was closed without being published."
            />
          ) : (
            <StatusDisplay
              status="pending"
              message={
                polling
                  ? `${UX.CHECKING_STATUS}`
                  : 'Your proposal is awaiting review. You\'ll be able to see when it\'s published.'
              }
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={proposal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            {UX.VIEW_PROPOSAL} on GitHub
          </a>
          <Link
            href={`/repo/${repoFullName}`}
            className="btn btn-secondary"
          >
            Back to workspace
          </Link>
        </div>

        {/* Refresh hint */}
        {polling && (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Automatically checking for updates...
          </p>
        )}
      </main>
    </div>
  );
}

function Header({ repoFullName }: { repoFullName: string }) {
  return (
    <header className="border-b border-[var(--border)]">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/repos" className="font-bold text-lg">
            DashDraft
          </Link>
          <span className="text-[var(--muted)]">/</span>
          <Link
            href={`/repo/${repoFullName}`}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {repoFullName}
          </Link>
          <span className="text-[var(--muted)]">/</span>
          <span>{UX.PROPOSAL}</span>
        </div>
      </div>
    </header>
  );
}

function ConflictMessage({ prUrl }: { prUrl: string }) {
  const guidance = getConflictGuidance();

  return (
    <div className="card border-[var(--error)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚠️</span>
        <h2 className="font-semibold text-[var(--error)]">{guidance.title}</h2>
      </div>

      <p className="text-sm text-[var(--muted)] mb-4">{guidance.message}</p>

      <div className="mb-4">
        <h3 className="text-sm font-medium mb-2">What to do:</h3>
        <ol className="text-sm text-[var(--muted)] space-y-1 list-decimal list-inside">
          {guidance.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <a
        href={prUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
      >
        {guidance.cta}
      </a>
    </div>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
