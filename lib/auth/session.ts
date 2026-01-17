/**
 * Session Management
 *
 * Server-side session handling with HTTP-only cookies.
 * Session tokens are never exposed to client-side JavaScript.
 */

import { cookies } from 'next/headers';
import {
  createSession as dbCreateSession,
  findValidSession,
  deleteSession as dbDeleteSession,
} from '@/lib/db/models';
import type { User, Session } from '@/lib/db/models';

const SESSION_COOKIE_NAME = '__session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

// ============================================================================
// Session Cookie Operations
// ============================================================================

interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

function getCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  };
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Create a new session for a user and set the session cookie
 */
export async function createSession(userId: string): Promise<Session> {
  const session = await dbCreateSession(userId);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.id, getCookieOptions());

  return session;
}

/**
 * Get the current session from the request cookies
 * Returns null if no valid session exists
 */
export async function getCurrentSession(): Promise<(Session & { user: User }) | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  const session = await findValidSession(sessionId);

  if (!session) {
    // Clear invalid session cookie
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session;
}

/**
 * Get the current user from the session
 * Convenience function that returns just the user
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/**
 * Require authentication - throws if no valid session
 */
export async function requireSession(): Promise<Session & { user: User }> {
  const session = await getCurrentSession();

  if (!session) {
    throw new AuthenticationError('Authentication required');
  }

  return session;
}

/**
 * Require authentication - throws if no valid session
 * Returns just the user for convenience
 */
export async function requireUser(): Promise<User> {
  const session = await requireSession();
  return session.user;
}

/**
 * Destroy the current session
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await dbDeleteSession(sessionId);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

// ============================================================================
// Errors
// ============================================================================

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// ============================================================================
// API Response Helpers
// ============================================================================

/**
 * Get session data formatted for API response
 */
export async function getSessionResponse(): Promise<{
  user: { id: string; login: string; avatarUrl: string };
  expiresAt: string;
} | null> {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      login: session.user.login,
      avatarUrl: session.user.avatarUrl,
    },
    expiresAt: session.expiresAt.toISOString(),
  };
}
