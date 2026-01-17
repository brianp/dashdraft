/**
 * GitHub Contents API
 *
 * Functions for fetching file and directory contents from repositories.
 */

import { getInstallationToken } from './app-auth';
import { createLogger } from '@/lib/logger';

const logger = createLogger('github-contents');

// ============================================================================
// Types
// ============================================================================

export interface GitHubFileEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  sha: string;
}

export interface GitHubFileContent {
  path: string;
  content: string;
  encoding: 'base64' | 'utf-8';
  sha: string;
  size: number;
}

// ============================================================================
// Directory Listing
// ============================================================================

/**
 * Get directory contents (files and subdirectories)
 */
export async function getDirectoryContents(
  installationId: number,
  owner: string,
  repo: string,
  path: string = ''
): Promise<GitHubFileEntry[]> {
  const token = await getInstallationToken(installationId);
  const encodedPath = path ? encodeURIComponent(path) : '';

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    logger.error('Failed to get directory contents', {
      owner,
      repo,
      path,
      status: response.status,
    });
    throw new Error(`Failed to get directory contents: ${response.status}`);
  }

  const data = await response.json();

  // If it's a single file, wrap it in an array
  if (!Array.isArray(data)) {
    return [
      {
        name: data.name,
        path: data.path,
        type: data.type,
        size: data.size ?? 0,
        sha: data.sha,
      },
    ];
  }

  return data.map((item: {
    name: string;
    path: string;
    type: string;
    size?: number;
    sha: string;
  }) => ({
    name: item.name,
    path: item.path,
    type: item.type === 'dir' ? 'dir' : 'file',
    size: item.size ?? 0,
    sha: item.sha,
  }));
}

// ============================================================================
// File Content
// ============================================================================

/**
 * Get file content
 */
export async function getFileContent(
  installationId: number,
  owner: string,
  repo: string,
  path: string
): Promise<GitHubFileContent | null> {
  const token = await getInstallationToken(installationId);
  const encodedPath = encodeURIComponent(path);

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    logger.error('Failed to get file content', {
      owner,
      repo,
      path,
      status: response.status,
    });
    throw new Error(`Failed to get file content: ${response.status}`);
  }

  const data = await response.json();

  // GitHub returns directory listing if path is a directory
  if (Array.isArray(data)) {
    return null;
  }

  // GitHub returns base64 encoded content
  return {
    path: data.path,
    content: data.content,
    encoding: data.encoding === 'base64' ? 'base64' : 'utf-8',
    sha: data.sha,
    size: data.size,
  };
}

/**
 * Get file content decoded as string
 */
export async function getFileContentDecoded(
  installationId: number,
  owner: string,
  repo: string,
  path: string
): Promise<{ content: string; sha: string } | null> {
  const file = await getFileContent(installationId, owner, repo, path);

  if (!file) {
    return null;
  }

  let content: string;
  if (file.encoding === 'base64') {
    // Decode base64 content
    content = Buffer.from(file.content, 'base64').toString('utf-8');
  } else {
    content = file.content;
  }

  return { content, sha: file.sha };
}

// ============================================================================
// Tree API (for efficient bulk operations)
// ============================================================================

/**
 * Get repository tree (recursive)
 * More efficient than contents API for large directories
 */
export async function getRepositoryTree(
  installationId: number,
  owner: string,
  repo: string,
  sha: string,
  recursive: boolean = false
): Promise<GitHubTreeEntry[]> {
  const token = await getInstallationToken(installationId);

  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}${recursive ? '?recursive=1' : ''}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    logger.error('Failed to get repository tree', {
      owner,
      repo,
      sha,
      status: response.status,
    });
    throw new Error(`Failed to get repository tree: ${response.status}`);
  }

  const data = await response.json();

  if (data.truncated) {
    logger.warn('Repository tree was truncated', { owner, repo, sha });
  }

  return data.tree.map((item: {
    path: string;
    type: string;
    sha: string;
    size?: number;
  }) => ({
    path: item.path,
    type: item.type === 'tree' ? 'dir' : 'file',
    sha: item.sha,
    size: item.size ?? 0,
  }));
}

export interface GitHubTreeEntry {
  path: string;
  type: 'file' | 'dir';
  sha: string;
  size: number;
}

// ============================================================================
// File existence check
// ============================================================================

/**
 * Check if a file exists
 */
export async function fileExists(
  installationId: number,
  owner: string,
  repo: string,
  path: string
): Promise<boolean> {
  const token = await getInstallationToken(installationId);
  const encodedPath = encodeURIComponent(path);

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  return response.ok;
}
