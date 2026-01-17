import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { authorizedDb } from '@/lib/db/authorized';
import type { GetInstallationsResponse } from '@/lib/types/api';

/**
 * GET /api/installations
 *
 * Returns the list of GitHub App installations for the current user.
 */
export async function GET(): Promise<NextResponse<GetInstallationsResponse>> {
  try {
    const user = await requireUser();
    const db = authorizedDb(user.id);

    const installations = await db.installations.findAll();

    return NextResponse.json({
      data: installations.map((i) => ({
        id: i.installationId,
        accountLogin: i.accountLogin,
        accountType: i.accountType as 'User' | 'Organization',
        avatarUrl: i.accountAvatar,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthenticationError') {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: 'Failed to fetch installations' },
      { status: 500 }
    );
  }
}
