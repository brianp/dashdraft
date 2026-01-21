/**
 * AI Module Exports
 *
 * Central export point for all AI-related functionality.
 */

// Types
export type {
  AIKickstartRequest,
  AIAssistRequest,
  AIResponse,
  AISuggestionType,
  ActivityState,
  ActivityConfig,
  AIPanelState,
  AIPanelProps,
  AIPreferences,
} from './types';

export { DEFAULT_AI_PREFERENCES } from './types';

// Service functions
export {
  generateKickstart,
  generateAssistance,
  generateContinuation,
  processCompleteResponse,
  checkRateLimit,
  cleanupRateLimits,
} from './service';

// Prompts (for testing/customization)
export {
  BASE_SYSTEM_PROMPT,
  KICKSTART_SYSTEM_PROMPT,
  ASSIST_SYSTEM_PROMPT,
  buildKickstartPrompt,
  buildAssistPrompt,
  cleanAIResponse,
} from './prompts';

// Feature flags
export {
  isAIEnabled,
  isKickstartEnabled,
  isAssistEnabled,
  getAIFeatureFlags,
} from './feature-flags';
