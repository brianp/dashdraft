/**
 * AI Service Layer
 *
 * Encapsulates AI SDK calls for documentation assistance features.
 * Uses Vercel AI SDK with Vercel AI Gateway.
 *
 * Setup: Set AI_GATEWAY_API_KEY in environment variables.
 * The SDK automatically routes through Vercel's gateway when this key is present.
 */

import { streamText } from 'ai';
import { createLogger } from '@/lib/logger';
import {
  KICKSTART_SYSTEM_PROMPT,
  ASSIST_SYSTEM_PROMPT,
  buildKickstartPrompt,
  buildAssistPrompt,
  cleanAIResponse,
} from './prompts';
import type { AIKickstartRequest, AIAssistRequest, AISuggestionType } from './types';

const logger = createLogger('ai-service');

// ============================================================================
// Configuration
// ============================================================================

/**
 * Model identifier for Vercel AI Gateway
 * Format: provider/model-name
 */
const AI_MODEL = 'openai/gpt-4o-mini';

/**
 * Default model configuration
 */
const MODEL_CONFIG = {
  model: AI_MODEL,
  maxTokens: 2000,
  temperature: 0.7,
};

/**
 * Model for more complex tasks (kickstart)
 */
const KICKSTART_MODEL_CONFIG = {
  model: AI_MODEL,
  maxTokens: 3000,
  temperature: 0.7,
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Generate initial document structure from user summary
 * Returns a streaming response
 */
export async function generateKickstart(request: AIKickstartRequest) {
  const { summary, context } = request;

  logger.info('Generating kickstart', {
    summaryLength: summary.length,
    hasContext: !!context,
  });

  const userPrompt = buildKickstartPrompt(summary, context);

  const result = streamText({
    ...KICKSTART_MODEL_CONFIG,
    system: KICKSTART_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result;
}

/**
 * Generate assistance for stuck users
 * Returns a streaming response
 */
export async function generateAssistance(request: AIAssistRequest) {
  const { content, cursorPosition, assistType = 'continue' } = request;

  logger.info('Generating assistance', {
    contentLength: content.length,
    hasCursorPosition: cursorPosition !== undefined,
    assistType,
  });

  const userPrompt = buildAssistPrompt(content, cursorPosition, assistType);

  const result = streamText({
    ...MODEL_CONFIG,
    system: ASSIST_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result;
}

/**
 * Generate a continuation of the current content
 * Specialized version of assist for continuing writing
 */
export async function generateContinuation(
  content: string,
  cursorPosition?: number
) {
  return generateAssistance({
    content,
    cursorPosition,
    assistType: 'continue',
  });
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Process a complete AI response (non-streaming)
 * Used for testing or when streaming isn't needed
 */
export async function processCompleteResponse(
  streamResult: Awaited<ReturnType<typeof streamText>>
): Promise<{ text: string; type: AISuggestionType }> {
  const { text } = streamResult;
  const resolvedText = await text;
  return {
    text: cleanAIResponse(resolvedText),
    type: 'continuation',
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Simple in-memory rate limiter
 * In production, this should use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 30; // requests per window

/**
 * Check if a user is rate limited
 */
export function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now >= userLimit.resetAt) {
    // New window
    const resetAt = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt };
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: userLimit.resetAt };
  }

  userLimit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - userLimit.count,
    resetAt: userLimit.resetAt,
  };
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [userId, limit] of rateLimitMap.entries()) {
    if (now >= limit.resetAt) {
      rateLimitMap.delete(userId);
    }
  }
}
