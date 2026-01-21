/**
 * UX Terminology Constants
 *
 * CRITICAL: This file defines the product-centric vocabulary used throughout the UI.
 * The application MUST NOT use Git terminology (branch, commit, SHA, rebase, merge, pull request, etc.)
 * in any user-facing strings.
 *
 * Instead, we use these product-centric terms:
 * - "Draft" instead of "uncommitted changes"
 * - "Propose changes" instead of "create pull request"
 * - "Proposal" instead of "pull request"
 * - "Submit for review" instead of "push"
 * - "Published" instead of "merged"
 * - "Conflicts" are mentioned only when necessary, with guidance
 */

export const UX = {
  // Core actions
  SIGN_IN: 'Sign in with GitHub',
  SIGN_OUT: 'Sign out',

  // Document states
  DRAFT: 'Draft',
  AUTOSAVED: 'Autosaved',
  READY_TO_PROPOSE: 'Ready to propose',

  // Primary actions
  PROPOSE_CHANGES: 'Propose changes',
  SUBMIT_FOR_REVIEW: 'Submit for review',
  UPDATE_PROPOSAL: 'Update proposal',
  DISCARD_DRAFT: 'Discard draft',
  RESTORE_DRAFT: 'Restore draft',

  // Proposal states
  PROPOSAL: 'Proposal',
  VIEW_PROPOSAL: 'View proposal',
  PROPOSAL_PENDING: 'Pending review',
  PROPOSAL_APPROVED: 'Approved',
  PROPOSAL_PUBLISHED: 'Published',
  PROPOSAL_CLOSED: 'Closed',

  // Published state (what happens after merge)
  PUBLISHED: 'Published',

  // File operations
  NEW_FILE: 'New file',
  EDIT_FILE: 'Edit',
  DELETE_FILE: 'Delete',
  RENAME_FILE: 'Rename',

  // Conflict messaging (used sparingly)
  CONFLICT_TITLE: 'Changes cannot be applied automatically',
  CONFLICT_MESSAGE:
    'Someone else has made changes to the same files. Please visit the proposal on GitHub to resolve this.',
  CONFLICT_CTA: 'View on GitHub',

  // Status messages
  CHECKING_STATUS: 'Checking status...',
  CHANGES_SAVED: 'Changes saved',
  SAVING: 'Saving...',

  // Repository context
  WORKSPACE: 'Workspace',
  WORKSPACE_SETTINGS: 'Workspace settings',
  ENABLED_REPOS: 'Enabled repositories',
  GRANT_ACCESS: 'Grant access',

  // Generic
  TAGLINE: 'Edit and propose changes to your documentation',
  LOADING: 'Loading...',
  ERROR: 'Something went wrong',
  TRY_AGAIN: 'Try again',
  CANCEL: 'Cancel',
  CONTINUE: 'Continue',
  CLOSE: 'Close',

  // AI Features
  AI_ASSISTANT: 'Writing Assistant',
  AI_GET_SUGGESTION: 'Get suggestion',
  AI_INSERT: 'Insert',
  AI_GENERATING: 'Generating...',
  AI_HELP_START: 'Help me start',
  AI_WRITE_SCRATCH: 'Write from scratch',
  AI_GENERATE_OUTLINE: 'Generate outline',
  AI_USE_OUTLINE: 'Use this outline',
  AI_NEED_HELP: 'Need help continuing?',
  AI_OFFER_MESSAGE: 'I can suggest what to write next.',
  AI_NEW_DOC_TITLE: 'Start a new document',
  AI_NEW_DOC_MESSAGE: 'Would you like help getting started? Describe what you want to document and I\'ll create an outline for you.',
  AI_WHAT_TO_DOCUMENT: 'What would you like to document?',
} as const;

/**
 * Forbidden terms that should NEVER appear in UI strings.
 * Used by the lint:ux-terms script to catch violations.
 */
export const FORBIDDEN_GIT_TERMS = [
  'branch',
  'branches',
  'commit',
  'commits',
  'committed',
  'uncommitted',
  'SHA',
  'hash',
  'rebase',
  'rebasing',
  'merge',
  'merged',
  'merging',
  'pull request',
  'pull-request',
  'PR',
  'push',
  'pushed',
  'pushing',
  'fetch',
  'fetched',
  'fetching',
  'clone',
  'cloned',
  'cloning',
  'checkout',
  'stash',
  'HEAD',
  'origin',
  'upstream',
  'remote',
  'diff',
  'patch',
  'cherry-pick',
  'squash',
  'amend',
  'force push',
  'ref',
  'refs',
  'tree-ish',
  'blob',
  'staging area',
  'staged',
  'unstaged',
  'working tree',
  'working directory',
  'index',
  'detached HEAD',
  'fast-forward',
  'three-way merge',
] as const;

/**
 * Maps internal/API terms to user-facing terms.
 * Use this when transforming GitHub API responses for display.
 */
export const TERM_MAP: Record<string, string> = {
  pull_request: UX.PROPOSAL,
  pr: UX.PROPOSAL,
  merged: UX.PUBLISHED,
  merge: 'publish',
  branch: 'version',
  commit: 'change',
  push: 'submit',
};

/**
 * Helper to transform API error messages to user-friendly language.
 * Replaces Git terminology with product terminology.
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  // Replace common Git terms in error messages
  const replacements: [RegExp, string][] = [
    [/pull request/gi, UX.PROPOSAL.toLowerCase()],
    [/branch/gi, 'version'],
    [/commit/gi, 'change'],
    [/merge conflict/gi, 'conflict'],
    [/merged/gi, UX.PUBLISHED.toLowerCase()],
    [/push/gi, 'submit'],
    [/repository/gi, 'workspace'],
  ];

  for (const [pattern, replacement] of replacements) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}
