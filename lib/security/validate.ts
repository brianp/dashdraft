/**
 * Input Validation
 *
 * Validates and sanitizes user input, especially repository and file paths.
 * Prevents path traversal and other injection attacks.
 */

import { z } from 'zod';

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Dangerous path patterns that indicate traversal attempts
 */
const DANGEROUS_PATTERNS = [
  /\.\./,              // Parent directory
  /^\//, // Absolute path
  /^\\/,               // Windows absolute path
  /^[a-zA-Z]:/,        // Windows drive letter
  /\0/,                // Null byte
  /%2e%2e/i,           // URL-encoded ..
  /%252e%252e/i,       // Double-encoded ..
  /%c0%ae/i,           // Unicode encoded .
  /%c1%9c/i,           // Unicode encoded /
];

/**
 * Allowed file characters (conservative)
 */
const SAFE_PATH_CHARS = /^[a-zA-Z0-9._\-/]+$/;

/**
 * Normalize a file path for comparison
 * Returns null if the path is invalid or dangerous
 */
export function normalizePath(input: string): string | null {
  // Check for dangerous patterns before processing
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      return null;
    }
  }

  // Reject paths with unsafe characters
  if (!SAFE_PATH_CHARS.test(input)) {
    return null;
  }

  // Normalize slashes and remove redundant segments
  const parts = input.split('/').filter((p) => p && p !== '.');
  const normalized: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      // This shouldn't happen due to earlier check, but be defensive
      return null;
    }
    normalized.push(part);
  }

  const result = normalized.join('/');

  // Final safety check - ensure no traversal
  if (result.includes('..') || result.startsWith('/')) {
    return null;
  }

  return result;
}

/**
 * Check if a path is within an allowed base directory
 */
export function isPathWithinBase(path: string, base: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedBase = normalizePath(base);

  if (!normalizedPath || !normalizedBase) {
    return false;
  }

  // Empty base means root is allowed
  if (normalizedBase === '') {
    return true;
  }

  return normalizedPath === normalizedBase || normalizedPath.startsWith(normalizedBase + '/');
}

/**
 * Validate a file path against allowed patterns (glob-like)
 */
export function matchesAllowedPath(path: string, patterns: string[]): boolean {
  const normalized = normalizePath(path);
  if (!normalized) {
    return false;
  }

  for (const pattern of patterns) {
    if (matchGlob(normalized, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Simple glob matching (supports * and **)
 */
function matchGlob(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*\*/g, '{{GLOBSTAR}}')     // Placeholder for **
    .replace(/\*/g, '[^/]*')              // Single * matches within segment
    .replace(/{{GLOBSTAR}}/g, '.*');      // ** matches across segments

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

// ============================================================================
// Repository Validation
// ============================================================================

/**
 * GitHub repository name format: owner/repo
 */
const REPO_NAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?\/[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

/**
 * Validate a repository full name (owner/repo)
 */
export function validateRepoFullName(input: string): string | null {
  if (!input || input.length > 200) {
    return null;
  }

  if (!REPO_NAME_PATTERN.test(input)) {
    return null;
  }

  return input.toLowerCase();
}

/**
 * Parse repository full name into owner and repo
 */
export function parseRepoFullName(fullName: string): { owner: string; repo: string } | null {
  const validated = validateRepoFullName(fullName);
  if (!validated) {
    return null;
  }

  const [owner, repo] = validated.split('/');
  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

// ============================================================================
// Zod Schemas for API Validation
// ============================================================================

export const repoFullNameSchema = z.string().refine(
  (val) => validateRepoFullName(val) !== null,
  { message: 'Invalid repository name' }
);

export const filePathSchema = z.string().refine(
  (val) => normalizePath(val) !== null,
  { message: 'Invalid file path' }
);

export const proposalTitleSchema = z.string().min(1).max(256).trim();

export const proposalDescriptionSchema = z.string().max(65536).trim();

export const changeSetSchema = z.object({
  repoFullName: repoFullNameSchema,
  modified: z.record(z.string()),
  created: z.record(z.string()),
  deleted: z.array(z.string()),
  assets: z.array(z.string()),
});

// ============================================================================
// Content Validation
// ============================================================================

/**
 * Maximum file size for Markdown content (1MB)
 */
export const MAX_MARKDOWN_SIZE = 1 * 1024 * 1024;

/**
 * Maximum file size for assets (5MB)
 */
export const MAX_ASSET_SIZE = 5 * 1024 * 1024;

/**
 * Allowed asset MIME types
 */
export const ALLOWED_ASSET_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

/**
 * Validate asset file
 */
export function validateAsset(
  mimeType: string,
  size: number
): { valid: boolean; error?: string } {
  if (!ALLOWED_ASSET_TYPES.includes(mimeType)) {
    return { valid: false, error: `File type ${mimeType} is not allowed` };
  }

  if (size > MAX_ASSET_SIZE) {
    return { valid: false, error: `File size exceeds maximum of ${MAX_ASSET_SIZE / 1024 / 1024}MB` };
  }

  return { valid: true };
}

/**
 * Validate Markdown content
 */
export function validateMarkdownContent(content: string): { valid: boolean; error?: string } {
  if (content.length > MAX_MARKDOWN_SIZE) {
    return { valid: false, error: `Content exceeds maximum size of ${MAX_MARKDOWN_SIZE / 1024 / 1024}MB` };
  }

  // Check for null bytes
  if (content.includes('\0')) {
    return { valid: false, error: 'Content contains invalid characters' };
  }

  return { valid: true };
}

// ============================================================================
// AI Feature Validation
// ============================================================================

/**
 * Maximum length for AI kickstart summary
 */
export const MAX_AI_SUMMARY_LENGTH = 500;

/**
 * Maximum content length to send to AI (to stay within token limits)
 */
export const MAX_AI_CONTENT_LENGTH = 50000;

/**
 * Schema for AI kickstart request
 * Note: useCompletion sends the user's text as "prompt"
 */
export const aiKickstartSchema = z.object({
  prompt: z
    .string()
    .min(10, 'Please provide a bit more detail (at least 10 characters)')
    .max(MAX_AI_SUMMARY_LENGTH, `Summary must be less than ${MAX_AI_SUMMARY_LENGTH} characters`),
  context: z
    .object({
      repoName: z.string().optional(),
      filePath: z.string().optional(),
    })
    .optional(),
});

/**
 * Schema for AI assist request
 * Note: useCompletion sends the user's text as "prompt"
 */
export const aiAssistSchema = z.object({
  prompt: z
    .string()
    .max(MAX_AI_CONTENT_LENGTH, 'Document is too long for AI assistance'),
  cursorPosition: z.number().int().nonnegative().optional(),
  assistType: z.enum(['continue', 'improve', 'explain']).optional(),
});
