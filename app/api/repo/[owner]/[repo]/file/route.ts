import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb, AuthorizationError } from '@/lib/db/authorized';
import { getFileContentDecoded } from '@/lib/github/contents';
import { normalizePath } from '@/lib/security/validate';
import type { GetFileResponse } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-file');

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/**
 * GET /api/repo/[owner]/[repo]/file
 *
 * Returns file content for a path in the repository.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<GetFileResponse>> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);

    const { owner, repo } = await params;
    const repoFullName = `${owner}/${repo}`;

    // This throws AuthorizationError if user doesn't have access
    const { installationId } = await db.repos.requireAccess(repoFullName);

    // Get and validate path from query params
    const searchParams = request.nextUrl.searchParams;
    const rawPath = searchParams.get('path');

    if (!rawPath) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Path parameter is required' },
        { status: 400 }
      );
    }

    const path = normalizePath(rawPath);
    if (!path) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Invalid path' },
        { status: 400 }
      );
    }

    // Fetch file content from GitHub
    const file = await getFileContentDecoded(
      installationId,
      owner,
      repo,
      path
    );

    if (!file) {
      return NextResponse.json(
        { error: 'not_found', message: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        path,
        content: file.content,
        encoding: 'utf-8',
        sha: file.sha,
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

    logger.error('Failed to fetch file', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch file content' },
      { status: 500 }
    );
  }
}
