import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb, AuthorizationError } from '@/lib/db/authorized';
import { aiKickstartSchema } from '@/lib/security/validate';
import { generateKickstart, checkRateLimit } from '@/lib/ai/service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('api-ai-kickstart');

interface RouteParams {
  params: Promise<{
    owner: string;
    repo: string;
  }>;
}

/**
 * POST /api/repo/[owner]/[repo]/ai/kickstart
 *
 * Generates an initial document structure from a user summary.
 * Returns a streaming response.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<Response> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);

    const { owner, repo } = await params;
    const repoFullName = `${owner}/${repo}`;

    // Check repository access
    await db.repos.requireAccess(repoFullName);

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'Too many AI requests. Please wait before trying again.',
          resetAt: rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    // Parse and validate request body
    let body;
    try {
      const rawBody = await request.json();
      body = aiKickstartSchema.parse(rawBody);
    } catch (err) {
      logger.warn('Invalid kickstart request', { error: err });
      return NextResponse.json(
        { error: 'bad_request', message: 'Invalid request body' },
        { status: 400 }
      );
    }

    logger.info('Generating kickstart', {
      userId: user.id,
      repoFullName,
      promptLength: body.prompt.length,
    });

    // Generate the kickstart content (streaming)
    const result = await generateKickstart({
      summary: body.prompt,
      context: {
        repoName: repoFullName,
        ...body.context,
      },
    });

    // Return streaming response
    return result.toTextStreamResponse({
      headers: {
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': rateLimit.resetAt.toString(),
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

    logger.error('Failed to generate kickstart', { error });
    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
