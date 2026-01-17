import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForUser, getUserInstallations } from '@/lib/github/app-auth';
import { upsertUser, upsertInstallation } from '@/lib/db/models';
import { createSession } from '@/lib/auth/session';
import { getBaseUrl } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const logger = createLogger('auth-callback');

/**
 * GET /api/auth/callback
 *
 * Handles the OAuth callback from GitHub.
 * Exchanges the code for a token, creates/updates the user, and establishes a session.
 *
 * Also handles GitHub App installation callbacks (when user installs app from GitHub).
 * In that case, we redirect to login to start proper OAuth flow.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const installationId = searchParams.get('installation_id');
  const setupAction = searchParams.get('setup_action');

  // Handle GitHub App installation callback (no state, has installation_id)
  // This happens when user installs the app directly from GitHub
  // Redirect to login to start proper OAuth flow
  if (installationId && setupAction && !state) {
    logger.info('App installation callback, redirecting to login', { installationId, setupAction });
    const loginUrl = new URL('/login', getBaseUrl());
    loginUrl.searchParams.set('installed', 'true');
    return NextResponse.redirect(loginUrl);
  }

  // Handle OAuth errors
  if (error) {
    logger.error('OAuth error from GitHub', { error });
    return redirectToLogin('Authentication was cancelled or failed');
  }

  // Validate required parameters
  if (!code || !state) {
    return redirectToLogin('Invalid authentication response');
  }

  // Verify state token
  const cookieStore = await cookies();
  const authStateCookie = cookieStore.get('__auth_state')?.value;

  if (!authStateCookie) {
    return redirectToLogin('Authentication session expired');
  }

  let authState: { state: string; redirectTo: string };
  try {
    authState = JSON.parse(authStateCookie);
  } catch {
    return redirectToLogin('Invalid authentication session');
  }

  if (authState.state !== state) {
    return redirectToLogin('Invalid authentication state');
  }

  // Clear the auth state cookie
  cookieStore.delete('__auth_state');

  try {
    // Exchange code for user info
    const { accessToken, user: githubUser } = await exchangeCodeForUser(code);

    // Create or update user in database
    const user = await upsertUser({
      githubUserId: githubUser.id,
      login: githubUser.login,
      avatarUrl: githubUser.avatarUrl,
    });

    // Get user's installations and store them
    const installations = await getUserInstallations(accessToken);

    for (const installation of installations) {
      await upsertInstallation({
        installationId: installation.id,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        accountAvatar: installation.avatarUrl,
        userId: user.id,
      });
    }

    // Create session
    await createSession(user.id);

    logger.info('User authenticated', { userId: user.id, login: user.login });

    // Redirect to original destination or repos page
    const redirectTo = authState.redirectTo || '/repos';
    return NextResponse.redirect(new URL(redirectTo, getBaseUrl()));
  } catch (err) {
    logger.error('Authentication failed', { error: err });
    return redirectToLogin('Authentication failed. Please try again.');
  }
}

function redirectToLogin(errorMessage: string): NextResponse {
  const url = new URL('/login', getBaseUrl());
  url.searchParams.set('error', errorMessage);
  return NextResponse.redirect(url);
}
