import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateCsrfToken, csrfErrorResponse } from '@/lib/security/csrf';
import { checkRateLimit, rateLimiters, rateLimitResponse } from '@/lib/security/rate-limit';

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/repos',
  '/repo/',
  '/api/repos',
  '/api/repo/',
  '/api/installations',
];

/**
 * Routes that require CSRF protection (state-changing)
 */
const CSRF_PROTECTED_ROUTES = [
  '/api/repo/',
  '/api/auth/logout',
];

/**
 * Rate limit configurations by route pattern
 */
const RATE_LIMIT_CONFIGS: { pattern: RegExp; config: typeof rateLimiters.api }[] = [
  { pattern: /^\/api\/auth\//, config: rateLimiters.auth },
  { pattern: /^\/api\/repo\/[^/]+\/[^/]+\/propose/, config: rateLimiters.propose },
  { pattern: /^\/api\/repo\/[^/]+\/[^/]+\/(tree|file)/, config: rateLimiters.read },
  { pattern: /^\/api\//, config: rateLimiters.api },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const limiterConfig = RATE_LIMIT_CONFIGS.find((c) => c.pattern.test(pathname));
    if (limiterConfig) {
      const { allowed, retryAfter } = checkRateLimit(request, limiterConfig.config);
      if (!allowed && retryAfter) {
        return rateLimitResponse(retryAfter);
      }
    }
  }

  // CSRF validation for protected routes
  const needsCsrf = CSRF_PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (needsCsrf) {
    const isValid = await validateCsrfToken(request);
    if (!isValid) {
      return csrfErrorResponse();
    }
  }

  // Authentication check for protected routes
  const needsAuth = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (needsAuth) {
    const sessionCookie = request.cookies.get('__session');

    if (!sessionCookie?.value) {
      // Redirect to login for page routes
      if (!pathname.startsWith('/api/')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Return 401 for API routes
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
  }

  // Add security headers to all responses
  const response = NextResponse.next();

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS protection (legacy, but doesn't hurt)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
