/**
 * Starlight Detection
 *
 * Heuristic detection of Starlight documentation sites.
 * This provides helpful hints but never blocks functionality.
 */

import { getFileContentDecoded, fileExists } from '@/lib/github/contents';
import { createLogger } from '@/lib/logger';

const logger = createLogger('starlight');

// ============================================================================
// Types
// ============================================================================

export interface StarlightHints {
  isLikelyStarlight: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  hints: StarlightHint[];
}

export interface StarlightHint {
  type: 'info' | 'tip' | 'warning';
  title: string;
  message: string;
  learnMoreUrl?: string;
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Detect if a repository is likely a Starlight documentation site
 */
export async function detectStarlight(
  installationId: number,
  owner: string,
  repo: string
): Promise<StarlightHints> {
  const hints: StarlightHint[] = [];
  let confidence: StarlightHints['confidence'] = 'none';

  try {
    // Check for package.json
    const packageJson = await getFileContentDecoded(
      installationId,
      owner,
      repo,
      'package.json'
    );

    if (packageJson) {
      const parsed = JSON.parse(packageJson.content);

      // Check for Starlight dependency
      const deps = {
        ...parsed.dependencies,
        ...parsed.devDependencies,
      };

      if (deps['@astrojs/starlight']) {
        confidence = 'high';
        hints.push({
          type: 'info',
          title: 'Starlight documentation detected',
          message: 'This looks like a Starlight documentation site. Your Markdown files will be rendered using Starlight\'s styling.',
          learnMoreUrl: 'https://starlight.astro.build/',
        });
      } else if (deps['astro']) {
        confidence = 'medium';
        hints.push({
          type: 'info',
          title: 'Astro site detected',
          message: 'This appears to be an Astro site. Markdown files may have special frontmatter requirements.',
          learnMoreUrl: 'https://docs.astro.build/en/guides/markdown-content/',
        });
      }
    }

    // Check for astro.config.* files
    const hasAstroConfig =
      (await fileExists(installationId, owner, repo, 'astro.config.mjs')) ||
      (await fileExists(installationId, owner, repo, 'astro.config.ts')) ||
      (await fileExists(installationId, owner, repo, 'astro.config.js'));

    if (hasAstroConfig && confidence === 'none') {
      confidence = 'low';
      hints.push({
        type: 'info',
        title: 'Astro configuration found',
        message: 'This project appears to use Astro.',
      });
    }

    // Check for common Starlight directory structure
    const hasDocsDir = await fileExists(installationId, owner, repo, 'src/content/docs');
    if (hasDocsDir) {
      if (confidence === 'none') {
        confidence = 'medium';
      }
      hints.push({
        type: 'tip',
        title: 'Content collection structure',
        message: 'Documentation files are in src/content/docs/. New files should include frontmatter with at least a title.',
      });
    }

  } catch (error) {
    logger.debug('Error during Starlight detection', { error });
    // Don't fail - detection is best-effort
  }

  return {
    isLikelyStarlight: confidence !== 'none',
    confidence,
    hints,
  };
}

// ============================================================================
// Frontmatter Hints
// ============================================================================

/**
 * Generate frontmatter hints for a Starlight file
 */
export function getStarlightFrontmatterHints(filePath: string): StarlightHint[] {
  const hints: StarlightHint[] = [];

  // Check if this is a docs file
  if (filePath.includes('content/docs')) {
    hints.push({
      type: 'tip',
      title: 'Frontmatter required',
      message: 'Starlight docs need frontmatter. At minimum, include:\n---\ntitle: Your Page Title\n---',
      learnMoreUrl: 'https://starlight.astro.build/reference/frontmatter/',
    });
  }

  return hints;
}

/**
 * Validate frontmatter for Starlight requirements
 */
export function validateStarlightFrontmatter(
  content: string
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check if content has frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    return {
      valid: false,
      warnings: ['This file is missing frontmatter. Starlight requires at least a title.'],
    };
  }

  const frontmatter = frontmatterMatch[1] ?? '';

  // Check for required title
  if (!frontmatter.includes('title:')) {
    warnings.push('Missing required "title" in frontmatter.');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
