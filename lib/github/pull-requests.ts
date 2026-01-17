/**
 * Pull Request Operations
 *
 * Functions for fetching and managing PR status.
 */

import { getInstallationToken } from './app-auth';
import { sanitizeErrorMessage } from '@/lib/constants/ux-terms';
import { createLogger } from '@/lib/logger';
import type { ProposalStatus } from '@/lib/types/api';

const logger = createLogger('github-prs');

// ============================================================================
// Types
// ============================================================================

export interface PRDetails {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// PR Status
// ============================================================================

/**
 * Get PR details
 */
export async function getPRDetails(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRDetails> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get PR details: ${response.status}`);
  }

  const data = await response.json();

  return {
    number: data.number,
    title: data.title,
    body: data.body ?? '',
    state: data.state,
    merged: data.merged,
    mergeable: data.mergeable,
    mergeableState: data.mergeable_state,
    htmlUrl: data.html_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Convert GitHub PR state to our ProposalStatus
 */
export function prStateToProposalStatus(pr: PRDetails): ProposalStatus {
  if (pr.merged) {
    return 'published';
  }

  if (pr.state === 'closed') {
    return 'closed';
  }

  if (pr.mergeable === false || pr.mergeableState === 'dirty') {
    return 'conflict';
  }

  // Check if approved (would need to fetch reviews for accurate status)
  // For now, just return pending
  return 'pending';
}

/**
 * Check PR mergeability with polling
 * GitHub computes mergeability asynchronously
 */
export async function checkMergeability(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  maxAttempts: number = 5
): Promise<{ mergeable: boolean | null; state: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pr = await getPRDetails(installationId, owner, repo, prNumber);

    if (pr.mergeable !== null) {
      return { mergeable: pr.mergeable, state: pr.mergeableState };
    }

    // Wait before retrying (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Return null if we couldn't determine mergeability
  return { mergeable: null, state: 'unknown' };
}

// ============================================================================
// PR Listing
// ============================================================================

/**
 * List PRs created by the app for a repo
 */
export async function listRepoPRs(
  installationId: number,
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'all'
): Promise<PRDetails[]> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list PRs: ${response.status}`);
  }

  const data = await response.json();

  return data.map((pr: {
    number: number;
    title: string;
    body: string | null;
    state: string;
    merged_at: string | null;
    mergeable: boolean | null;
    mergeable_state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
  }) => ({
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    state: pr.state,
    merged: !!pr.merged_at,
    mergeable: pr.mergeable,
    mergeableState: pr.mergeable_state,
    htmlUrl: pr.html_url,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
  }));
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle GitHub API errors with user-friendly messages
 */
export function handlePRError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;

    // Common error mappings
    if (message.includes('422')) {
      return 'Could not create proposal. The changes may already exist or there may be a conflict.';
    }

    if (message.includes('403')) {
      return 'Access denied. Please check that you have permission to make changes.';
    }

    if (message.includes('404')) {
      return 'Repository not found. It may have been deleted or renamed.';
    }

    // Sanitize any remaining Git terminology
    return sanitizeErrorMessage(message);
  }

  return 'An unexpected error occurred. Please try again.';
}
