import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthorizationUrl } from '@/lib/github/app-auth';
import { getBaseUrl } from '@/lib/env';

/**
 * GET /api/auth/start
 *
 * Initiates the GitHub OAuth flow.
 * Generates a state token, stores it in a cookie, and redirects to GitHub.
 */
export async function GET(request: NextRequest) {
  // Generate state token for CSRF protection
  const state = generateState();

  // Get redirect URL from query params (where to go after auth)
  const searchParams = request.nextUrl.searchParams;
  const redirectTo = searchParams.get('redirect') || '/repos';

  // Store state and redirect in a short-lived cookie
  const cookieStore = await cookies();
  cookieStore.set('__auth_state', JSON.stringify({ state, redirectTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });

  // Build the callback URL
  const callbackUrl = `${getBaseUrl()}/api/auth/callback`;

  // Redirect to GitHub authorization
  const authUrl = getAuthorizationUrl(state, callbackUrl);

  return NextResponse.redirect(authUrl);
}

function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
