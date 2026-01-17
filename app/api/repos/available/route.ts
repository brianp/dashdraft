import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb } from '@/lib/db/authorized';
import { getAllInstallationRepos } from '@/lib/github/repos';
import type { Repository } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-repos-available');

/**
 * GET /api/repos/available?installation=123
 *
 * Returns the list of repositories available for a given installation.
 * Used by the RepoPicker to show which repos the user can enable.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser();
    logger.info('Fetching available repos', { userId: user.id });

    const db = authorizedDb(user.id);

    const installationIdParam = request.nextUrl.searchParams.get('installation');
    if (!installationIdParam) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Missing installation parameter' },
        { status: 400 }
      );
    }

    const installationId = parseInt(installationIdParam, 10);
    if (isNaN(installationId)) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Invalid installation parameter' },
        { status: 400 }
      );
    }

    logger.info('Looking up installation', { installationId, userId: user.id });

    // Verify user has access to this installation
    const installation = await db.installations.findByInstallationId(installationId);
    if (!installation) {
      logger.warn('Installation not found for user', { installationId, userId: user.id });
      return NextResponse.json(
        { error: 'not_found', message: 'Installation not found. Try signing out and back in.' },
        { status: 404 }
      );
    }

    logger.info('Found installation, fetching repos from GitHub', {
      installationId,
      accountLogin: installation.accountLogin
    });

    // Fetch repos from GitHub
    const githubRepos = await getAllInstallationRepos(installationId);

    logger.info('Fetched repos from GitHub', { count: githubRepos.length });

    const repos: Repository[] = githubRepos.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      name: r.name,
      owner: r.owner,
      description: r.description,
      isPrivate: r.isPrivate,
      defaultBranch: r.defaultBranch,
    }));

    return NextResponse.json({ data: repos });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthenticationError') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Log the full error details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Failed to fetch available repos', {
      error: errorMessage,
      stack: errorStack,
    });

    return NextResponse.json(
      { error: 'internal_error', message: `Failed to fetch repositories: ${errorMessage}` },
      { status: 500 }
    );
  }
}
