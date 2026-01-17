import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { findRepoAccess } from '@/lib/db/models';
import { detectStarlight } from '@/lib/validation/starlight';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-starlight');

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/**
 * GET /api/repo/[owner]/[repo]/starlight-hints
 *
 * Returns Starlight-specific hints for the repository.
 * This is optional enhancement - failure doesn't block functionality.
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const { owner, repo } = await params;
    const repoFullName = `${owner}/${repo}`;

    // Check repo access
    const access = await findRepoAccess(user.id, repoFullName);
    if (!access) {
      return NextResponse.json(
        { error: 'not_found', message: 'Repository not found or not accessible' },
        { status: 404 }
      );
    }

    // Detect Starlight
    const hints = await detectStarlight(
      access.installation.installationId,
      owner,
      repo
    );

    return NextResponse.json({ data: hints });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthenticationError') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Log but don't fail - hints are optional
    logger.warn('Failed to get Starlight hints', { error });
    return NextResponse.json({
      data: {
        isLikelyStarlight: false,
        confidence: 'none',
        hints: [],
      },
    });
  }
}
