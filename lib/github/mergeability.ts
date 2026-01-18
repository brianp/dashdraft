/**
 * Mergeability Checking
 *
 * Handles checking and polling for PR mergeability status.
 */

import { getPRDetails } from './pull-requests';
import type { ProposalStatus } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('mergeability');

// ============================================================================
// Types
// ============================================================================

export interface MergeabilityResult {
  status: ProposalStatus;
  canMerge: boolean;
  hasConflicts: boolean;
  checkInProgress: boolean;
  message: string;
}

// ============================================================================
// Mergeability Check
// ============================================================================

/**
 * Check the mergeability of a PR
 * Returns a user-friendly result without Git terminology
 */
export async function checkProposalMergeability(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<MergeabilityResult> {
  try {
    // First get PR details
    const pr = await getPRDetails(installationId, owner, repo, prNumber);

    // Check if already merged or closed
    if (pr.merged) {
      return {
        status: 'published',
        canMerge: false,
        hasConflicts: false,
        checkInProgress: false,
        message: 'Your changes have been published.',
      };
    }

    if (pr.state === 'closed') {
      return {
        status: 'closed',
        canMerge: false,
        hasConflicts: false,
        checkInProgress: false,
        message: 'This proposal has been closed.',
      };
    }

    // Check mergeability
    if (pr.mergeable === null) {
      // GitHub is still computing
      return {
        status: 'pending',
        canMerge: false,
        hasConflicts: false,
        checkInProgress: true,
        message: 'Checking if your changes can be applied...',
      };
    }

    if (pr.mergeable === false || pr.mergeableState === 'dirty') {
      return {
        status: 'conflict',
        canMerge: false,
        hasConflicts: true,
        checkInProgress: false,
        message: 'Your changes cannot be applied automatically because someone else has made changes to the same files.',
      };
    }

    // Can be merged
    return {
      status: 'pending',
      canMerge: true,
      hasConflicts: false,
      checkInProgress: false,
      message: 'Your proposal is ready for review.',
    };
  } catch (error) {
    logger.error('Failed to check mergeability', { error, owner, repo, prNumber });
    throw error;
  }
}

/**
 * Poll for mergeability with backoff
 * Useful when GitHub hasn't computed the mergeable status yet
 */
export async function pollForMergeability(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number,
  maxWaitMs: number = 60000
): Promise<MergeabilityResult> {
  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < maxWaitMs) {
    const result = await checkProposalMergeability(
      installationId,
      owner,
      repo,
      prNumber
    );

    if (!result.checkInProgress) {
      return result;
    }

    // Exponential backoff
    attempt++;
    const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Timed out waiting for result
  return {
    status: 'pending',
    canMerge: false,
    hasConflicts: false,
    checkInProgress: true,
    message: 'Still checking if your changes can be applied. Please refresh to check the status.',
  };
}

// ============================================================================
// Conflict Guidance
// ============================================================================

/**
 * Get user-friendly guidance for conflicts
 */
export function getConflictGuidance(): {
  title: string;
  message: string;
  steps: string[];
  cta: string;
} {
  return {
    title: 'Changes cannot be applied automatically',
    message: 'Someone else has made changes to the same files since you started editing. This needs to be resolved before your proposal can be accepted.',
    steps: [
      'Open the proposal on GitHub using the button below',
      'Follow GitHub\'s instructions to resolve the overlapping changes',
      'Once resolved, your proposal can be reviewed and accepted',
    ],
    cta: 'View on GitHub',
  };
}
