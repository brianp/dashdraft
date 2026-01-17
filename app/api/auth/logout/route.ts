import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';
import { getBaseUrl } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('auth-logout');

/**
 * POST /api/auth/logout
 *
 * Destroys the current session and clears the session cookie.
 * Requires CSRF token for protection.
 */
export async function POST() {
  try {
    await destroySession();
    logger.info('User logged out');

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Logout failed', { error: err });
    return NextResponse.json(
      { error: 'logout_failed', message: 'Failed to log out' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/logout
 *
 * Alternative logout that redirects to home page.
 * Less secure than POST but useful for simple logout links.
 */
export async function GET() {
  try {
    await destroySession();
    logger.info('User logged out via GET');

    return NextResponse.redirect(new URL('/', getBaseUrl()));
  } catch (err) {
    logger.error('Logout failed', { error: err });
    return NextResponse.redirect(new URL('/', getBaseUrl()));
  }
}
