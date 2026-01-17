/**
 * Configuration Validation
 *
 * Validates .md-editor.json configuration files.
 */

import { z } from 'zod';
import type { RepoConfig } from '@/lib/types/api';
import { DEFAULT_CONFIG } from './defaults';

/**
 * Schema for .md-editor.json
 */
const configSchema = z.object({
  docsRoot: z.string().optional(),
  assetsDir: z.string().optional(),
  allowedExtensions: z.array(z.string()).optional(),
  allowPaths: z.array(z.string()).optional(),
}).strict();

/**
 * Validate and parse a raw config object
 * Returns the validated config with defaults applied
 */
export function validateConfig(raw: unknown): {
  valid: boolean;
  config?: RepoConfig;
  errors?: string[];
} {
  // Parse JSON if string
  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        valid: false,
        errors: ['Invalid JSON format'],
      };
    }
  } else {
    parsed = raw;
  }

  // Validate against schema
  const result = configSchema.safeParse(parsed);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }

  // Merge with defaults
  const config: RepoConfig = {
    docsRoot: result.data.docsRoot ?? DEFAULT_CONFIG.docsRoot,
    assetsDir: result.data.assetsDir ?? DEFAULT_CONFIG.assetsDir,
    allowedExtensions: result.data.allowedExtensions ?? DEFAULT_CONFIG.allowedExtensions,
    allowPaths: result.data.allowPaths ?? DEFAULT_CONFIG.allowPaths,
    isInferred: false, // Explicitly loaded from file
  };

  // Validate paths don't have dangerous patterns
  const pathErrors = validatePaths(config);
  if (pathErrors.length > 0) {
    return {
      valid: false,
      errors: pathErrors,
    };
  }

  return {
    valid: true,
    config,
  };
}

/**
 * Validate that paths don't contain dangerous patterns
 */
function validatePaths(config: RepoConfig): string[] {
  const errors: string[] = [];
  const dangerousPatterns = ['..', '//'];

  // Check docsRoot
  if (dangerousPatterns.some((p) => config.docsRoot.includes(p))) {
    errors.push('docsRoot contains invalid path pattern');
  }

  // Check assetsDir
  if (dangerousPatterns.some((p) => config.assetsDir.includes(p))) {
    errors.push('assetsDir contains invalid path pattern');
  }

  // Check allowPaths
  for (const path of config.allowPaths) {
    if (dangerousPatterns.some((p) => path.includes(p))) {
      errors.push(`allowPaths contains invalid pattern: ${path}`);
    }
  }

  return errors;
}

/**
 * Validate file extension format
 */
export function isValidExtension(ext: string): boolean {
  return /^\.[a-zA-Z0-9]+$/.test(ext);
}

/**
 * Validate all extensions in config
 */
export function validateExtensions(extensions: string[]): string[] {
  return extensions.filter((ext) => !isValidExtension(ext));
}
