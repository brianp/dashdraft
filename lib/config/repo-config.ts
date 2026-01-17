/**
 * Repository Configuration Discovery
 *
 * Discovers and loads repository configuration from:
 * 1. .md-editor.json file in repository root
 * 2. Inference based on common patterns
 */

import { getFileContentDecoded, fileExists } from '@/lib/github/contents';
import { validateConfig } from './validate-config';
import { DEFAULT_CONFIG, CONFIG_FILE_NAME, ALT_CONFIG_FILE_NAMES, COMMON_DOCS_ROOTS, COMMON_ASSETS_DIRS } from './defaults';
import type { RepoConfig } from '@/lib/types/api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('repo-config');

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load repository configuration
 * First tries to load from config file, then infers from repository structure
 */
export async function loadRepoConfig(
  installationId: number,
  owner: string,
  repo: string
): Promise<RepoConfig> {
  // Try to load from config file
  const fromFile = await loadConfigFile(installationId, owner, repo);
  if (fromFile) {
    logger.info('Loaded config from file', { owner, repo });
    return fromFile;
  }

  // Infer from repository structure
  const inferred = await inferConfig(installationId, owner, repo);
  logger.info('Inferred config from repository structure', { owner, repo, config: inferred });
  return inferred;
}

/**
 * Try to load configuration from a config file
 */
async function loadConfigFile(
  installationId: number,
  owner: string,
  repo: string
): Promise<RepoConfig | null> {
  // Try primary config file name
  const configFiles = [CONFIG_FILE_NAME, ...ALT_CONFIG_FILE_NAMES];

  for (const fileName of configFiles) {
    try {
      const content = await getFileContentDecoded(installationId, owner, repo, fileName);
      if (!content) {
        continue;
      }

      const result = validateConfig(content.content);
      if (result.valid && result.config) {
        return result.config;
      }

      // Log validation errors but continue trying other files
      if (result.errors) {
        logger.warn('Config validation errors', {
          owner,
          repo,
          file: fileName,
          errors: result.errors,
        });
      }
    } catch (err) {
      // File doesn't exist or can't be read, continue
      logger.debug('Config file not found or unreadable', { owner, repo, file: fileName });
    }
  }

  return null;
}

// ============================================================================
// Config Inference
// ============================================================================

/**
 * Infer configuration from repository structure
 */
async function inferConfig(
  installationId: number,
  owner: string,
  repo: string
): Promise<RepoConfig> {
  const config: RepoConfig = { ...DEFAULT_CONFIG, isInferred: true };

  // Try to find docs root
  const docsRoot = await findDocsRoot(installationId, owner, repo);
  if (docsRoot) {
    config.docsRoot = docsRoot;
    config.allowPaths = [`${docsRoot}/**/*.md`, `${docsRoot}/**/*.mdx`];
  }

  // Try to find assets directory
  const assetsDir = await findAssetsDir(installationId, owner, repo, config.docsRoot);
  if (assetsDir) {
    config.assetsDir = assetsDir;
  }

  return config;
}

/**
 * Find the documentation root directory
 */
async function findDocsRoot(
  installationId: number,
  owner: string,
  repo: string
): Promise<string | null> {
  // Check common docs directories
  for (const dir of COMMON_DOCS_ROOTS) {
    const exists = await fileExists(installationId, owner, repo, dir);
    if (exists) {
      return dir;
    }
  }

  // No specific docs directory found, use root
  return null;
}

/**
 * Find the assets directory
 */
async function findAssetsDir(
  installationId: number,
  owner: string,
  repo: string,
  docsRoot: string
): Promise<string | null> {
  // First check relative to docs root
  if (docsRoot && docsRoot !== '.') {
    const relativeAssetsDirs = ['assets', 'images', 'static'];
    for (const dir of relativeAssetsDirs) {
      const path = `${docsRoot}/${dir}`;
      const exists = await fileExists(installationId, owner, repo, path);
      if (exists) {
        return path;
      }
    }
  }

  // Check common asset directories at root
  for (const dir of COMMON_ASSETS_DIRS) {
    const exists = await fileExists(installationId, owner, repo, dir);
    if (exists) {
      return dir;
    }
  }

  // Default to assets in docs root or root
  if (docsRoot && docsRoot !== '.') {
    return `${docsRoot}/assets`;
  }
  return 'assets';
}

// ============================================================================
// Config Caching (Client-side)
// ============================================================================

/**
 * Cache key for repository config
 */
export function getConfigCacheKey(repoFullName: string): string {
  return `repo-config:${repoFullName}`;
}

/**
 * Config with metadata for display
 */
export interface ConfigWithMeta {
  config: RepoConfig;
  source: 'file' | 'inferred';
  loadedAt: string;
}
