import { NextResponse } from 'next/server';
import { getSessionResponse } from '@/lib/auth/session';
import { getOrCreateCsrfToken } from '@/lib/security/csrf';

/**
 * GET /api/auth/session
 *
 * Returns the current session information.
 * Also sets/refreshes the CSRF token cookie.
 */
export async function GET() {
  const session = await getSessionResponse();

  // Get or create CSRF token (will set cookie if needed)
  const csrfToken = await getOrCreateCsrfToken();

  const response = NextResponse.json({
    data: session,
  });

  // Include CSRF token in response header for client to use
  response.headers.set('X-CSRF-Token', csrfToken);

  return response;
}
