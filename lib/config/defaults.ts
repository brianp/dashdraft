/**
 * Default Configuration Values
 *
 * These defaults are used when no .md-editor.json is found
 * or when specific fields are missing from the config.
 */

import type { RepoConfig } from '@/lib/types/api';

/**
 * Default repository configuration
 */
export const DEFAULT_CONFIG: RepoConfig = {
  docsRoot: '.',
  assetsDir: 'assets',
  allowedExtensions: ['.md', '.mdx'],
  allowPaths: ['**/*.md', '**/*.mdx'],
  isInferred: true,
};

/**
 * Common documentation root directories to check
 * Listed in order of preference
 */
export const COMMON_DOCS_ROOTS = [
  'docs',
  'documentation',
  'content',
  'src/content',
  'src/docs',
  'pages/docs',
  'website/docs',
];

/**
 * Common assets directories to check
 */
export const COMMON_ASSETS_DIRS = [
  'assets',
  'images',
  'static',
  'public',
  'docs/assets',
  'docs/images',
  'content/assets',
  'content/images',
];

/**
 * Config file name
 */
export const CONFIG_FILE_NAME = '.md-editor.json';

/**
 * Alternative config file names (for compatibility)
 */
export const ALT_CONFIG_FILE_NAMES = [
  '.dashdraft.json',
  'dashdraft.config.json',
];
