/**
 * GitHub API Mocks
 *
 * Mock responses for GitHub API endpoints used in tests.
 */

// ============================================================================
// Mock Builders
// ============================================================================

export function mockUser(overrides: Partial<GitHubUserResponse> = {}): GitHubUserResponse {
  return {
    id: 12345,
    login: 'testuser',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345',
    ...overrides,
  };
}

export function mockRepository(overrides: Partial<GitHubRepoResponse> = {}): GitHubRepoResponse {
  return {
    id: 67890,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    owner: { login: 'testuser' },
    description: 'A test repository',
    private: false,
    default_branch: 'main',
    ...overrides,
  };
}

export function mockInstallation(overrides: Partial<GitHubInstallationResponse> = {}): GitHubInstallationResponse {
  return {
    id: 11111,
    account: {
      login: 'testuser',
      type: 'User',
      avatar_url: 'https://avatars.githubusercontent.com/u/12345',
    },
    ...overrides,
  };
}

export function mockRef(sha: string, ref: string = 'refs/heads/main'): GitHubRefResponse {
  return {
    ref,
    object: { sha },
  };
}

export function mockCommit(sha: string, treeSha: string): GitHubCommitResponse {
  return {
    sha,
    tree: { sha: treeSha },
  };
}

export function mockBlob(sha: string): GitHubBlobResponse {
  return { sha };
}

export function mockTree(sha: string): GitHubTreeResponse {
  return { sha };
}

export function mockPullRequest(overrides: Partial<GitHubPRResponse> = {}): GitHubPRResponse {
  return {
    number: 42,
    title: 'Test PR',
    body: 'Test description',
    state: 'open',
    merged: false,
    mergeable: true,
    mergeable_state: 'clean',
    html_url: 'https://github.com/testuser/test-repo/pull/42',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

export function mockFileContent(path: string, content: string): GitHubContentResponse {
  return {
    name: path.split('/').pop() ?? path,
    path,
    type: 'file',
    content: Buffer.from(content).toString('base64'),
    encoding: 'base64',
    sha: 'abc123',
    size: content.length,
  };
}

export function mockDirectoryContent(entries: Array<{ name: string; path: string; type: 'file' | 'dir' }>): GitHubContentResponse[] {
  return entries.map((entry) => ({
    name: entry.name,
    path: entry.path,
    type: entry.type,
    sha: 'abc123',
    size: entry.type === 'file' ? 100 : 0,
  }));
}

// ============================================================================
// Types
// ============================================================================

export interface GitHubUserResponse {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  private: boolean;
  default_branch: string;
}

export interface GitHubInstallationResponse {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url: string;
  };
}

export interface GitHubRefResponse {
  ref: string;
  object: { sha: string };
}

export interface GitHubCommitResponse {
  sha: string;
  tree: { sha: string };
}

export interface GitHubBlobResponse {
  sha: string;
}

export interface GitHubTreeResponse {
  sha: string;
}

export interface GitHubPRResponse {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubContentResponse {
  name: string;
  path: string;
  type: string;
  content?: string;
  encoding?: string;
  sha: string;
  size: number;
}

// ============================================================================
// Mock Fetch Helper
// ============================================================================

export interface MockRoute {
  pattern: RegExp;
  method?: string;
  response: unknown;
  status?: number;
}

export function createMockFetch(routes: MockRoute[]) {
  return async (url: string | URL, init?: RequestInit): Promise<Response> => {
    const urlString = url.toString();
    const method = init?.method ?? 'GET';

    for (const route of routes) {
      if (route.pattern.test(urlString) && (!route.method || route.method === method)) {
        return new Response(JSON.stringify(route.response), {
          status: route.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
