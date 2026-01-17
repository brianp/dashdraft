/**
 * GitHub App Authentication
 *
 * Handles:
 * - OAuth-like user authentication via GitHub App
 * - Installation token generation for API calls
 * - JWT generation for App-level API calls
 */

import { createLogger } from '@/lib/logger';
import { readFileSync, existsSync } from 'fs';
import { createSign } from 'crypto';

const logger = createLogger('github-auth');

// ============================================================================
// Configuration
// ============================================================================

function getConfig() {
  const appId = process.env.GITHUB_APP_ID;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  let privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !clientId || !clientSecret || !privateKey) {
    throw new Error('Missing GitHub App configuration');
  }

  // Support reading private key from file path
  // If the value looks like a file path (starts with / or ./), read from file
  if (privateKey.startsWith('/') || privateKey.startsWith('./')) {
    if (!existsSync(privateKey)) {
      throw new Error(`Private key file not found: ${privateKey}`);
    }
    privateKey = readFileSync(privateKey, 'utf-8');
    logger.info('Loaded private key from file');
  } else {
    // Private key may be stored with escaped newlines in env var
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Validate key format
  if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
    throw new Error('Invalid private key format: missing BEGIN/END markers');
  }

  return {
    appId,
    clientId,
    clientSecret,
    privateKey,
  };
}

// ============================================================================
// JWT Generation for App Authentication
// ============================================================================

/**
 * Generate a JWT for authenticating as the GitHub App
 * Used to request installation tokens
 */
function generateAppJwt(): string {
  const config = getConfig();
  const now = Math.floor(Date.now() / 1000);

  // JWT payload
  const payload = {
    iat: now - 60,        // Issued 60 seconds ago (clock skew tolerance)
    exp: now + 10 * 60,   // Expires in 10 minutes
    iss: config.appId,    // App ID as issuer
  };

  // Create JWT
  const header = { alg: 'RS256', typ: 'JWT' };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = signRs256(signingInput, config.privateKey);
  const encodedSignature = signature.toString('base64url');

  return `${signingInput}.${encodedSignature}`;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64url');
}

function signRs256(data: string, privateKeyPem: string): Buffer {
  // Use Node.js native crypto which handles both PKCS#1 and PKCS#8 formats
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  sign.end();
  return sign.sign(privateKeyPem);
}

// ============================================================================
// OAuth Flow
// ============================================================================

/**
 * Generate the GitHub OAuth authorization URL
 */
export function getAuthorizationUrl(state: string, redirectUri: string): string {
  const config = getConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    state,
    // We don't need additional scopes - installation grants repo access
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token and get user info
 */
export async function exchangeCodeForUser(
  code: string
): Promise<{ accessToken: string; user: GitHubUser }> {
  const config = getConfig();

  // Exchange code for token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    logger.error('OAuth token error', { error: tokenData.error });
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const accessToken = tokenData.access_token as string;

  // Get user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get user info');
  }

  const userData = await userResponse.json();

  return {
    accessToken,
    user: {
      id: userData.id,
      login: userData.login,
      avatarUrl: userData.avatar_url,
    },
  };
}

// ============================================================================
// Installation Token Generation
// ============================================================================

/**
 * Get an installation token for making API calls
 * Tokens are short-lived (1 hour) and should be requested per-request
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const jwt = generateAppJwt();

  logger.info('Requesting installation token', { installationId });

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error('Failed to get installation token', {
      installationId,
      status: response.status,
      statusText: response.statusText,
      error,
    });
    throw new Error(`Failed to get installation token: ${response.status} ${error}`);
  }

  const data = await response.json();
  logger.info('Got installation token', { installationId });
  return data.token as string;
}

// ============================================================================
// Installation Discovery
// ============================================================================

/**
 * Get installations accessible to a user
 */
export async function getUserInstallations(userAccessToken: string): Promise<GitHubInstallation[]> {
  const response = await fetch('https://api.github.com/user/installations', {
    headers: {
      Authorization: `Bearer ${userAccessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user installations');
  }

  const data = await response.json();
  const installations = data.installations as Array<{
    id: number;
    account: {
      login: string;
      type: string;
      avatar_url: string;
    };
  }>;

  return installations.map((i) => ({
    id: i.id,
    accountLogin: i.account.login,
    accountType: i.account.type as 'User' | 'Organization',
    avatarUrl: i.account.avatar_url,
  }));
}

/**
 * Get repositories accessible through an installation
 */
export async function getInstallationRepos(
  installationId: number,
  page = 1,
  perPage = 100
): Promise<{ repos: GitHubRepository[]; hasMore: boolean }> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/installation/repositories?page=${page}&per_page=${perPage}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to get installation repositories');
  }

  const data = await response.json();
  const repos = data.repositories as Array<{
    id: number;
    full_name: string;
    name: string;
    owner: { login: string };
    description: string | null;
    private: boolean;
    default_branch: string;
  }>;

  return {
    repos: repos.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      name: r.name,
      owner: r.owner.login,
      description: r.description,
      isPrivate: r.private,
      defaultBranch: r.default_branch,
    })),
    hasMore: repos.length === perPage,
  };
}

// ============================================================================
// Types
// ============================================================================

export interface GitHubUser {
  id: number;
  login: string;
  avatarUrl: string;
}

export interface GitHubInstallation {
  id: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  avatarUrl: string;
}

export interface GitHubRepository {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
}
