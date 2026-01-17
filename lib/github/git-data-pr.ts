/**
 * Git Data API for PR Creation
 *
 * Creates PRs using the Git Data API without local git.
 * Pipeline: get base ref → create blobs → create tree → create commit → create branch → create PR
 */

import { getInstallationToken } from './app-auth';
import { getDefaultBranchRef } from './repos';
import { createLogger } from '@/lib/logger';
import type { ChangeSet } from '@/lib/types/api';

const logger = createLogger('git-data-pr');

// ============================================================================
// Types
// ============================================================================

export interface CreatePRResult {
  prNumber: number;
  prUrl: string;
  branchName: string;
}

export interface TreeEntry {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'blob' | 'tree' | 'commit';
  sha: string;
}

export interface AuthorInfo {
  login: string;
  githubUserId: number;
}

// ============================================================================
// PR Creation Pipeline
// ============================================================================

/**
 * Create a PR from a changeset
 */
export async function createPRFromChangeset(
  installationId: number,
  owner: string,
  repo: string,
  changeset: ChangeSet,
  title: string,
  description: string,
  assetData: Map<string, ArrayBuffer>,
  author: AuthorInfo
): Promise<CreatePRResult> {
  const token = await getInstallationToken(installationId);
  const editDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Step 1: Get the base branch reference
  logger.info('Getting base branch reference', { owner, repo });
  const baseRef = await getDefaultBranchRef(installationId, owner, repo);
  if (!baseRef) {
    throw new Error('Could not find default branch');
  }

  // Step 2: Get the base commit and tree
  const baseCommit = await getCommit(token, owner, repo, baseRef.sha);
  const baseTreeSha = baseCommit.tree.sha;

  // Step 3: Create blobs for all changed files
  logger.info('Creating blobs for changed files', {
    modified: Object.keys(changeset.modified).length,
    created: Object.keys(changeset.created).length,
    assets: changeset.assets.length,
  });

  const treeEntries: TreeEntry[] = [];

  // Modified files - add edit history table
  for (const [path, content] of Object.entries(changeset.modified)) {
    const contentWithHistory = appendEditHistory(content, author.login, editDate);
    const blobSha = await createBlob(token, owner, repo, contentWithHistory, 'utf-8');
    treeEntries.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    });
  }

  // Created files - add edit history table
  for (const [path, content] of Object.entries(changeset.created)) {
    const contentWithHistory = appendEditHistory(content, author.login, editDate);
    const blobSha = await createBlob(token, owner, repo, contentWithHistory, 'utf-8');
    treeEntries.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    });
  }

  // Assets (binary blobs)
  for (const assetPath of changeset.assets) {
    const data = assetData.get(assetPath);
    if (!data) {
      logger.warn('Asset data not found', { path: assetPath });
      continue;
    }
    const base64Content = arrayBufferToBase64(data);
    const blobSha = await createBlob(token, owner, repo, base64Content, 'base64');
    treeEntries.push({
      path: assetPath,
      mode: '100644',
      type: 'blob',
      sha: blobSha,
    });
  }

  // Step 4: Create new tree
  logger.info('Creating new tree', { entryCount: treeEntries.length });
  const newTreeSha = await createTree(token, owner, repo, baseTreeSha, treeEntries);

  // Step 5: Create commit with co-author attribution
  logger.info('Creating commit');
  const authorEmail = `${author.githubUserId}+${author.login}@users.noreply.github.com`;
  const commitMessage = `${title}\n\n${description}\n\nCo-authored-by: ${author.login} <${authorEmail}>`;
  const newCommitSha = await createCommitObject(
    token,
    owner,
    repo,
    commitMessage,
    newTreeSha,
    [baseRef.sha]
  );

  // Step 6: Create branch
  const branchName = generateBranchName(title);
  logger.info('Creating branch', { branchName });
  await createRef(token, owner, repo, `refs/heads/${branchName}`, newCommitSha);

  // Step 7: Create PR with author attribution
  logger.info('Creating PR');
  const prBody = `${description}\n\n---\n\n_Proposed by @${author.login} via [DashDraft](https://github.com/apps/dashdraft)_`;
  const pr = await createPullRequest(
    token,
    owner,
    repo,
    title,
    prBody,
    branchName,
    baseRef.ref.replace('refs/heads/', '')
  );

  return {
    prNumber: pr.number,
    prUrl: pr.html_url,
    branchName,
  };
}

// ============================================================================
// Git Data API Operations
// ============================================================================

/**
 * Get a commit object
 */
async function getCommit(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<{ tree: { sha: string } }> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits/${sha}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get commit: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a blob
 */
async function createBlob(
  token: string,
  owner: string,
  repo: string,
  content: string,
  encoding: 'utf-8' | 'base64'
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, encoding }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create blob: ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Create a tree
 */
async function createTree(
  token: string,
  owner: string,
  repo: string,
  baseTreeSha: string,
  entries: TreeEntry[]
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: entries,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create tree: ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Create a commit
 */
async function createCommitObject(
  token: string,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parents: string[]
): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/commits`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create commit: ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

/**
 * Create a reference (branch)
 */
async function createRef(
  token: string,
  owner: string,
  repo: string,
  ref: string,
  sha: string
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref, sha }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create ref: ${response.status}`);
  }
}

/**
 * Create a pull request
 */
async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<{ number: number; html_url: string }> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, head, base }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to create PR', { status: response.status, error });
    throw new Error(`Failed to create PR: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a branch name from the PR title
 */
function generateBranchName(title: string): string {
  const timestamp = Date.now();
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);

  return `dashdraft/${slug}-${timestamp}`;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Append or update edit history table at the end of a markdown file
 */
function appendEditHistory(content: string, editorName: string, editDate: string): string {
  const historyMarker = '<!-- EDIT_HISTORY -->';
  const newEntry = `| ${editDate} | @${editorName} |`;

  // Check if edit history table already exists
  if (content.includes(historyMarker)) {
    // Find the table and add a new row
    const lines = content.split('\n');
    const markerIndex = lines.findIndex(line => line.includes(historyMarker));

    if (markerIndex !== -1) {
      // Find the end of the table (next empty line or end of file)
      let insertIndex = markerIndex + 1;
      while (insertIndex < lines.length && lines[insertIndex]?.startsWith('|')) {
        insertIndex++;
      }
      // Insert new entry before the last row (if exists) or at the end of table
      lines.splice(insertIndex, 0, newEntry);
      return lines.join('\n');
    }
  }

  // Create new edit history section
  const historySection = `

---

<details>
<summary>Edit History</summary>

${historyMarker}
| Date | Editor |
|------|--------|
${newEntry}

</details>`;

  return content.trimEnd() + historySection;
}
