/**
 * Shared API type definitions.
 * These types define the contract between client and server.
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError<T>(response: ApiResponse<T>): response is ApiError {
  return 'error' in response;
}

// ============================================================================
// User & Session
// ============================================================================

export interface User {
  id: string;
  login: string;
  avatarUrl: string;
}

export interface Session {
  user: User;
  expiresAt: string;
}

// ============================================================================
// Repository & Installation
// ============================================================================

export interface Installation {
  id: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  avatarUrl: string;
}

export interface Repository {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface EnabledRepository extends Repository {
  enabledAt: string;
  installationId: number;
}

// ============================================================================
// File System
// ============================================================================

export type FileType = 'file' | 'dir';

export interface FileEntry {
  name: string;
  path: string;
  type: FileType;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  sha: string; // Internal use only, never shown to user
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

// ============================================================================
// Workspace & Drafts
// ============================================================================

export type DraftStatus = 'clean' | 'dirty' | 'autosaved' | 'saving' | 'error';

export interface FileDraft {
  path: string;
  content: string;
  baseVersionId: string; // Internal reference, not shown to user
  status: DraftStatus;
  lastModified: string;
}

export interface AssetDraft {
  path: string;
  mimeType: string;
  size: number;
  // Bytes stored in IndexedDB, referenced by path
}

export interface ChangeSet {
  repoFullName: string;
  modified: Record<string, string>; // path -> content
  created: Record<string, string>; // path -> content
  deleted: string[]; // paths
  assets: string[]; // paths (bytes fetched from IndexedDB)
}

// ============================================================================
// Proposals (PRs without Git terminology)
// ============================================================================

export type ProposalStatus =
  | 'pending'    // Open, awaiting review
  | 'approved'   // Approved but not yet published
  | 'published'  // Merged
  | 'closed'     // Closed without publishing
  | 'conflict';  // Has merge conflicts

export interface Proposal {
  id: string;
  repoFullName: string;
  title: string;
  description: string;
  status: ProposalStatus;
  url: string; // GitHub PR URL for external viewing
  createdAt: string;
  updatedAt: string;
}

export interface CreateProposalRequest {
  repoFullName: string;
  title: string;
  description: string;
  changes: ChangeSet;
}

export interface CreateProposalResponse {
  proposal: Proposal;
}

// ============================================================================
// Repository Configuration
// ============================================================================

export interface RepoConfig {
  /** Root directory for documentation files */
  docsRoot: string;
  /** Directory for storing uploaded assets */
  assetsDir: string;
  /** Allowed file extensions for editing */
  allowedExtensions: string[];
  /** Allowed paths (glob patterns) */
  allowPaths: string[];
  /** Whether this config was inferred or loaded from file */
  isInferred: boolean;
}

export const DEFAULT_REPO_CONFIG: RepoConfig = {
  docsRoot: '.',
  assetsDir: 'assets',
  allowedExtensions: ['.md', '.mdx'],
  allowPaths: ['**/*.md', '**/*.mdx'],
  isInferred: true,
};

// ============================================================================
// API Route Types
// ============================================================================

// GET /api/auth/session
export type GetSessionResponse = ApiResponse<Session | null>;

// GET /api/repos
export type GetReposResponse = ApiResponse<EnabledRepository[]>;

// GET /api/installations
export type GetInstallationsResponse = ApiResponse<Installation[]>;

// GET /api/repo/[owner]/[repo]/tree?path=
export type GetTreeResponse = ApiResponse<DirectoryListing>;

// GET /api/repo/[owner]/[repo]/file?path=
export type GetFileResponse = ApiResponse<FileContent>;

// POST /api/repo/[owner]/[repo]/propose
export type ProposeResponse = ApiResponse<CreateProposalResponse>;

// GET /api/repo/[owner]/[repo]/proposal-status?id=
export type GetProposalStatusResponse = ApiResponse<Proposal>;
