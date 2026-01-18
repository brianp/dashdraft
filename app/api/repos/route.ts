import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb, AuthorizationError } from '@/lib/db/authorized';
import { getAllInstallationRepos } from '@/lib/github/repos';
import type { GetReposResponse, EnabledRepository } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-repos');

/**
 * GET /api/repos
 *
 * Returns the list of enabled repositories for the current user.
 */
export async function GET(): Promise<NextResponse<GetReposResponse>> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);  // Scoped to this user

    const repoAccess = await db.repos.findAll();

    const repos: EnabledRepository[] = repoAccess.map((ra) => ({
      id: ra.repoId,
      fullName: ra.repoFullName,
      name: ra.repoName,
      owner: ra.repoFullName.split('/')[0] ?? '',
      description: null,
      isPrivate: ra.isPrivate,
      defaultBranch: 'main',
      enabledAt: ra.createdAt.toISOString(),
      installationId: ra.installation.installationId,
    }));

    return NextResponse.json({ data: repos });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthenticationError') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error('Failed to fetch repos', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/repos
 *
 * Syncs repositories from GitHub for all user installations.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);

    const installations = await db.installations.findAll();
    const results: { installationId: number; repoCount: number }[] = [];

    for (const installation of installations) {
      try {
        const repos = await getAllInstallationRepos(installation.installationId);

        await db.repos.syncForInstallation(
          installation.installationId,
          repos.map((r) => ({
            repoId: r.id,
            repoFullName: r.fullName,
            repoName: r.name,
            isPrivate: r.isPrivate,
          }))
        );

        results.push({
          installationId: installation.installationId,
          repoCount: repos.length,
        });

        logger.info('Synced repos for installation', {
          installationId: installation.installationId,
          repoCount: repos.length,
        });
      } catch (err) {
        logger.error('Failed to sync repos for installation', {
          installationId: installation.installationId,
          error: err,
        });
      }
    }

    return NextResponse.json({ data: { synced: results } });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthenticationError') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { error: 'forbidden', message: error.message },
        { status: 403 }
      );
    }

    logger.error('Failed to sync repos', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to sync repositories' },
      { status: 500 }
    );
  }
}
