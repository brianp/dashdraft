import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb, AuthorizationError } from '@/lib/db/authorized';
import { getDirectoryContents } from '@/lib/github/contents';
import { normalizePath } from '@/lib/security/validate';
import type { GetTreeResponse, FileEntry } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-tree');

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/**
 * GET /api/repo/[owner]/[repo]/tree
 *
 * Returns directory listing for a path in the repository.
 * Supports lazy loading - only returns immediate children.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<GetTreeResponse>> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);

    const { owner, repo } = await params;
    const repoFullName = `${owner}/${repo}`;

    // This throws AuthorizationError if user doesn't have access
    const { installationId } = await db.repos.requireAccess(repoFullName);

    // Get and validate path from query params
    const searchParams = request.nextUrl.searchParams;
    const rawPath = searchParams.get('path') || '';
    const path = normalizePath(rawPath) ?? '';

    // Fetch directory contents from GitHub
    const contents = await getDirectoryContents(
      installationId,
      owner,
      repo,
      path
    );

    // Transform to API response format
    const entries: FileEntry[] = contents
      .map((item) => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.type === 'file' ? item.size : undefined,
      }))
      .sort((a, b) => {
        // Directories first, then alphabetically
        if (a.type !== b.type) {
          return a.type === 'dir' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      data: {
        path,
        entries,
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
        { status: 404 }  // Use 404 to not leak existence
      );
    }

    logger.error('Failed to fetch tree', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch directory contents' },
      { status: 500 }
    );
  }
}
