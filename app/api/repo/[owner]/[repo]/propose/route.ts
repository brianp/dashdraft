import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb, AuthorizationError } from '@/lib/db/authorized';
import { createPRFromChangeset } from '@/lib/github/git-data-pr';
import { changeSetSchema, proposalTitleSchema, proposalDescriptionSchema } from '@/lib/security/validate';
import type { ProposeResponse } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-propose');

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

const proposeRequestSchema = z.object({
  changeset: changeSetSchema,
  title: proposalTitleSchema,
  description: proposalDescriptionSchema,
  assets: z.record(z.string()).optional(),
});

/**
 * POST /api/repo/[owner]/[repo]/propose
 *
 * Creates a PR from the provided changeset.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ProposeResponse>> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);

    const { owner, repo } = await params;
    const repoFullName = `${owner}/${repo}`;

    // This throws AuthorizationError if user doesn't have access
    const { installationId } = await db.repos.requireAccess(repoFullName);

    // Parse and validate request body
    let body: z.infer<typeof proposeRequestSchema>;
    try {
      const rawBody = await request.json();
      body = proposeRequestSchema.parse(rawBody);
    } catch (err) {
      logger.warn('Invalid propose request', { error: err });
      return NextResponse.json(
        { error: 'bad_request', message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { changeset, title, description, assets } = body;

    // Verify changeset repo matches route
    if (changeset.repoFullName !== repoFullName) {
      return NextResponse.json(
        { error: 'bad_request', message: 'Changeset repository mismatch' },
        { status: 400 }
      );
    }

    // Decode asset data if provided
    const assetData = new Map<string, ArrayBuffer>();
    if (assets) {
      for (const [path, base64] of Object.entries(assets)) {
        try {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          assetData.set(path, bytes.buffer);
        } catch {
          logger.warn('Failed to decode asset', { path });
          return NextResponse.json(
            { error: 'bad_request', message: `Invalid asset data for ${path}` },
            { status: 400 }
          );
        }
      }
    }

    // Create PR
    logger.info('Creating PR', {
      owner,
      repo,
      userId: user.id,
      modifiedCount: Object.keys(changeset.modified).length,
      createdCount: Object.keys(changeset.created).length,
      assetCount: changeset.assets.length,
    });

    const result = await createPRFromChangeset(
      installationId,
      owner,
      repo,
      changeset,
      title,
      description,
      assetData,
      {
        login: user.login,
        githubUserId: user.githubUserId,
      }
    );

    // Store proposal using authorized db
    const proposal = await db.proposals.create({
      repoFullName,
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      title,
      status: 'pending',
    });

    logger.info('PR created', {
      prNumber: result.prNumber,
      prUrl: result.prUrl,
      proposalId: proposal.id,
    });

    return NextResponse.json({
      data: {
        proposal: {
          id: result.prNumber.toString(),
          repoFullName,
          title,
          description,
          status: 'pending',
          url: result.prUrl,
          createdAt: proposal.createdAt.toISOString(),
          updatedAt: proposal.updatedAt.toISOString(),
        },
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

    logger.error('Failed to create proposal', { error });

    if (error instanceof Error) {
      if (error.message.includes('422')) {
        return NextResponse.json(
          { error: 'conflict', message: 'Could not create proposal. The changes may conflict with existing content.' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}
