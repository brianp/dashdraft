/**
 * Rate Limiting
 *
 * Token bucket algorithm with in-memory storage.
 * For production multi-instance deployments, consider using Redis.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitConfig {
  /** Maximum tokens in bucket */
  maxTokens: number;
  /** Tokens added per second */
  refillRate: number;
  /** Unique identifier for this limiter (e.g., 'api', 'auth') */
  name: string;
}

// In-memory store - cleared on server restart
// For production: use Redis or similar
const buckets = new Map<string, TokenBucket>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_BUCKET_AGE = 60 * 60 * 1000; // 1 hour

let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }

  lastCleanup = now;
  const cutoff = now - MAX_BUCKET_AGE;

  for (const [key, bucket] of buckets) {
    if (bucket.lastRefill < cutoff) {
      buckets.delete(key);
    }
  }
}

/**
 * Get client identifier from request
 * Uses session cookie if available, otherwise falls back to IP
 */
function getClientId(request: NextRequest): string {
  // Prefer session-based identification
  const sessionId = request.cookies.get('__session')?.value;
  if (sessionId) {
    return `session:${sessionId}`;
  }

  // Fall back to IP-based identification
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

/**
 * Check rate limit and consume a token if allowed
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; retryAfter?: number } {
  cleanup();

  const clientId = getClientId(request);
  const key = `${config.name}:${clientId}`;
  const now = Date.now();

  let bucket = buckets.get(key);

  if (!bucket) {
    // New client - initialize full bucket
    bucket = {
      tokens: config.maxTokens,
      lastRefill: now,
    };
  } else {
    // Refill tokens based on time elapsed
    const elapsed = (now - bucket.lastRefill) / 1000;
    const refill = elapsed * config.refillRate;
    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    // Consume a token
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }

  // Rate limited - calculate retry time
  const tokensNeeded = 1 - bucket.tokens;
  const retryAfter = Math.ceil(tokensNeeded / config.refillRate);

  buckets.set(key, bucket);
  return { allowed: false, remaining: 0, retryAfter };
}

/**
 * Pre-configured rate limiters
 */
export const rateLimiters = {
  /** General API endpoints: 60 req/min */
  api: { name: 'api', maxTokens: 60, refillRate: 1 },

  /** Auth endpoints: 10 req/min */
  auth: { name: 'auth', maxTokens: 10, refillRate: 0.167 },

  /** Propose (PR creation): 5 req/min */
  propose: { name: 'propose', maxTokens: 5, refillRate: 0.083 },

  /** File read operations: 120 req/min */
  read: { name: 'read', maxTokens: 120, refillRate: 2 },
};

/**
 * Create a rate limit exceeded response
 */
export function rateLimitResponse(retryAfter: number): NextResponse {
  return NextResponse.json(
    {
      error: 'rate_limited',
      message: 'Too many requests. Please try again later.',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}

/**
 * Add rate limit headers to response
 */
export function withRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  config: RateLimitConfig
): NextResponse {
  response.headers.set('X-RateLimit-Limit', config.maxTokens.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  return response;
}
