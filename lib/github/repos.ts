/**
 * GitHub Repository Operations
 *
 * Functions for fetching and managing repository data.
 * All operations go through installation tokens - never user tokens.
 */

import { getInstallationToken, getInstallationRepos } from './app-auth';
import type { GitHubRepository } from './app-auth';
import { createLogger } from '@/lib/logger';

const logger = createLogger('github-repos');

// ============================================================================
// Repository Listing
// ============================================================================

/**
 * Get all repositories for an installation (paginated)
 */
export async function getAllInstallationRepos(
  installationId: number
): Promise<GitHubRepository[]> {
  const allRepos: GitHubRepository[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { repos, hasMore: more } = await getInstallationRepos(installationId, page);
    allRepos.push(...repos);
    hasMore = more;
    page++;

    // Safety limit
    if (page > 50) {
      logger.warn('Hit pagination limit for installation repos', { installationId });
      break;
    }
  }

  return allRepos;
}

// ============================================================================
// Repository Info
// ============================================================================

/**
 * Get repository information
 */
export async function getRepository(
  installationId: number,
  owner: string,
  repo: string
): Promise<GitHubRepository | null> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to get repository: ${response.status}`);
  }

  const data = await response.json();

  return {
    id: data.id,
    fullName: data.full_name,
    name: data.name,
    owner: data.owner.login,
    description: data.description,
    isPrivate: data.private,
    defaultBranch: data.default_branch,
  };
}

/**
 * Get the default branch reference
 */
export async function getDefaultBranchRef(
  installationId: number,
  owner: string,
  repo: string
): Promise<{ sha: string; ref: string } | null> {
  const repoInfo = await getRepository(installationId, owner, repo);
  if (!repoInfo) {
    return null;
  }

  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${repoInfo.defaultBranch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    logger.error('Failed to get default branch ref', {
      owner,
      repo,
      status: response.status,
    });
    return null;
  }

  const data = await response.json();

  return {
    sha: data.object.sha,
    ref: `refs/heads/${repoInfo.defaultBranch}`,
  };
}

// ============================================================================
// Types
// ============================================================================

export type { GitHubRepository };
