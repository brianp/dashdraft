import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb, AuthorizationError } from '@/lib/db/authorized';
import { checkProposalMergeability } from '@/lib/github/mergeability';
import type { GetProposalStatusResponse } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-proposal-status');

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/**
 * GET /api/repo/[owner]/[repo]/proposal-status?pr=123
 *
 * Returns the current status of a proposal.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<GetProposalStatusResponse>> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);

    const { owner, repo } = await params;
    const repoFullName = `${owner}/${repo}`;

    // Get PR number from query
    const prNumber = request.nextUrl.searchParams.get('pr');
    if (!prNumber) {
      return NextResponse.json(
        { error: 'bad_request', message: 'PR number is required' },
        { status: 400 }
      );
    }

    const prNum = parseInt(prNumber, 10);
    if (isNaN(prNum)) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Invalid PR number' },
        { status: 400 }
      );
    }

    // Check repo access (throws if not authorized)
    const { installationId } = await db.repos.requireAccess(repoFullName);

    // Get stored proposal (only returns if owned by this user)
    const storedProposal = await db.proposals.findByPR(repoFullName, prNum);
    if (!storedProposal) {
      return NextResponse.json(
        { error: 'not_found', message: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Check current status from GitHub
    const mergeability = await checkProposalMergeability(
      installationId,
      owner,
      repo,
      prNum
    );

    // Update stored status if changed
    if (storedProposal.status !== mergeability.status) {
      await db.proposals.updateStatus(repoFullName, prNum, mergeability.status);
    }

    return NextResponse.json({
      data: {
        id: storedProposal.id,
        repoFullName,
        title: storedProposal.title,
        description: '',
        status: mergeability.status,
        url: storedProposal.prUrl,
        createdAt: storedProposal.createdAt.toISOString(),
        updatedAt: storedProposal.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthenticationError') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: 'forbidden', message: 'Repository not found or not accessible' },
        { status: 404 }
      );
    }

    logger.error('Failed to get proposal status', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to get proposal status' },
      { status: 500 }
    );
  }
}
