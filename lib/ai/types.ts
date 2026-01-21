/**
 * AI Feature Types
 *
 * TypeScript interfaces for AI-assisted documentation features.
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request for AI kickstart - generates initial document structure
 */
export interface AIKickstartRequest {
  /** User's description of what they're documenting (1-3 sentences) */
  summary: string;
  /** Optional context about the repository/project */
  context?: {
    repoName?: string;
    filePath?: string;
  };
}

/**
 * Request for AI assistance - helps when user appears stuck
 */
export interface AIAssistRequest {
  /** Current document content */
  content: string;
  /** Optional cursor position for context-aware suggestions */
  cursorPosition?: number;
  /** Recent changes for style matching */
  recentChanges?: string;
  /** Type of assistance requested */
  assistType?: 'continue' | 'improve' | 'explain';
}

// ============================================================================
// Response Types
// ============================================================================

export type AISuggestionType = 'kickstart' | 'continuation' | 'improvement';

/**
 * AI response with generated content
 */
export interface AIResponse {
  /** Generated content or suggestion */
  suggestion: string;
  /** Type of suggestion provided */
  type: AISuggestionType;
}

// ============================================================================
// Activity Tracking Types
// ============================================================================

/**
 * User activity state for "stuck" detection
 */
export interface ActivityState {
  /** No keyboard/mouse activity for threshold period */
  isIdle: boolean;
  /** Idle + minimal recent progress = likely stuck */
  isStuck: boolean;
  /** Characters changed in recent window */
  recentCharacterDelta: number;
  /** Milliseconds since last edit */
  timeSinceLastEdit: number;
  /** Current content length for delta calculation */
  contentLength: number;
}

/**
 * Configuration for activity tracking thresholds
 */
export interface ActivityConfig {
  /** Milliseconds of inactivity before considered idle (default: 30000) */
  idleThreshold: number;
  /** Milliseconds of inactivity + minimal changes before considered stuck (default: 45000) */
  stuckThreshold: number;
  /** Minimum character changes to indicate progress (default: 50) */
  minimalProgressChars: number;
  /** Window in ms for measuring recent changes (default: 60000) */
  recentChangeWindow: number;
}

// ============================================================================
// UI State Types
// ============================================================================

export type AIPanelState =
  | 'hidden'      // Not shown
  | 'offer'       // Offering assistance
  | 'input'       // Collecting user input (kickstart)
  | 'loading'     // Generating response
  | 'result'      // Showing generated content
  | 'error';      // Error state with retry

/**
 * Props for AI panel components
 */
export interface AIPanelProps {
  /** Current panel state */
  state: AIPanelState;
  /** Callback when user accepts suggestion */
  onInsert: (content: string) => void;
  /** Callback when user dismisses panel */
  onDismiss: () => void;
  /** Callback to regenerate suggestion */
  onRegenerate?: () => void;
  /** Current suggestion (when in result state) */
  suggestion?: string;
  /** Error message (when in error state) */
  error?: string;
  /** Whether response is still streaming */
  isStreaming?: boolean;
}

// ============================================================================
// Preferences Types
// ============================================================================

/**
 * User preferences for AI features
 */
export interface AIPreferences {
  /** Master toggle for AI features */
  enabled: boolean;
  /** Show kickstart prompt for new files */
  showKickstartForNewFiles: boolean;
  /** Show assistance when user appears stuck */
  showAssistWhenStuck: boolean;
  /** Custom threshold in seconds for stuck detection */
  stuckThresholdSeconds: number;
}

/**
 * Default AI preferences
 */
export const DEFAULT_AI_PREFERENCES: AIPreferences = {
  enabled: true,
  showKickstartForNewFiles: true,
  showAssistWhenStuck: true,
  stuckThresholdSeconds: 45,
};
