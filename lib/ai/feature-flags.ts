/**
 * AI Feature Flags
 *
 * Controls for gradual rollout of AI features.
 */

/**
 * Check if AI features are enabled globally
 */
export function isAIEnabled(): boolean {
  // Server-side: check env directly
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
  }

  // Client-side: check the public env var
  return process.env.NEXT_PUBLIC_AI_ENABLED === 'true';
}

/**
 * Check if AI kickstart feature is enabled
 * (generates document outlines for new files)
 */
export function isKickstartEnabled(): boolean {
  if (!isAIEnabled()) return false;

  // Can be disabled separately if needed
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_AI_KICKSTART_ENABLED !== 'false';
  }
  return process.env.NEXT_PUBLIC_AI_KICKSTART_ENABLED !== 'false';
}

/**
 * Check if AI assist feature is enabled
 * (helps users who appear stuck)
 */
export function isAssistEnabled(): boolean {
  if (!isAIEnabled()) return false;

  // Can be disabled separately if needed
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_AI_ASSIST_ENABLED !== 'false';
  }
  return process.env.NEXT_PUBLIC_AI_ASSIST_ENABLED !== 'false';
}

/**
 * Get all AI feature flags
 */
export function getAIFeatureFlags() {
  return {
    aiEnabled: isAIEnabled(),
    kickstartEnabled: isKickstartEnabled(),
    assistEnabled: isAssistEnabled(),
  };
}
