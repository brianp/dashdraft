/**
 * Database model operations.
 *
 * Thin typed wrappers around Prisma operations.
 * These functions handle common operations and ensure consistent error handling.
 */

import { prisma } from './prisma';
import type { User, Session, Installation, RepoAccess, Proposal } from '@prisma/client';

// Re-export types for convenience
export type { User, Session, Installation, RepoAccess, Proposal };

// ============================================================================
// User Operations
// ============================================================================

export interface CreateUserInput {
  githubUserId: number;
  login: string;
  avatarUrl: string;
}

export async function findUserByGithubId(githubUserId: number): Promise<User | null> {
  return prisma.user.findUnique({
    where: { githubUserId },
  });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  });
}

export async function upsertUser(input: CreateUserInput): Promise<User> {
  return prisma.user.upsert({
    where: { githubUserId: input.githubUserId },
    update: {
      login: input.login,
      avatarUrl: input.avatarUrl,
    },
    create: input,
  });
}

// ============================================================================
// Session Operations
// ============================================================================

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId: string): Promise<Session> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  return prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });
}

export async function findValidSession(sessionId: string): Promise<(Session & { user: User }) | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  // Update last seen time (fire and forget)
  prisma.session.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  }).catch(() => {
    // Ignore errors - this is a non-critical update
  });

  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId },
  }).catch(() => {
    // Ignore if session doesn't exist
  });
}

export async function deleteExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ============================================================================
// Installation Operations
// ============================================================================

export interface CreateInstallationInput {
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  accountAvatar: string;
  userId: string;
}

export async function upsertInstallation(input: CreateInstallationInput): Promise<Installation> {
  return prisma.installation.upsert({
    where: { installationId: input.installationId },
    update: {
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      accountAvatar: input.accountAvatar,
      userId: input.userId,
    },
    create: input,
  });
}

export async function findInstallationsByUserId(userId: string): Promise<Installation[]> {
  return prisma.installation.findMany({
    where: { userId },
    orderBy: { accountLogin: 'asc' },
  });
}

export async function findInstallationById(installationId: number): Promise<Installation | null> {
  return prisma.installation.findUnique({
    where: { installationId },
  });
}

export async function deleteInstallation(installationId: number): Promise<void> {
  await prisma.installation.delete({
    where: { installationId },
  }).catch(() => {
    // Ignore if installation doesn't exist
  });
}

// ============================================================================
// RepoAccess Operations
// ============================================================================

export interface CreateRepoAccessInput {
  installationId: string;
  repoId: number;
  repoFullName: string;
  repoName: string;
  isPrivate: boolean;
}

export async function upsertRepoAccess(input: CreateRepoAccessInput): Promise<RepoAccess> {
  return prisma.repoAccess.upsert({
    where: {
      installationId_repoId: {
        installationId: input.installationId,
        repoId: input.repoId,
      },
    },
    update: {
      repoFullName: input.repoFullName,
      repoName: input.repoName,
      isPrivate: input.isPrivate,
    },
    create: input,
  });
}

export async function findRepoAccessByUser(userId: string): Promise<(RepoAccess & { installation: Installation })[]> {
  return prisma.repoAccess.findMany({
    where: {
      installation: { userId },
    },
    include: { installation: true },
    orderBy: { repoFullName: 'asc' },
  });
}

export async function findRepoAccess(
  userId: string,
  repoFullName: string
): Promise<(RepoAccess & { installation: Installation }) | null> {
  return prisma.repoAccess.findFirst({
    where: {
      repoFullName,
      installation: { userId },
    },
    include: { installation: true },
  });
}

export async function deleteRepoAccess(installationId: string, repoId: number): Promise<void> {
  await prisma.repoAccess.delete({
    where: {
      installationId_repoId: { installationId, repoId },
    },
  }).catch(() => {
    // Ignore if repo access doesn't exist
  });
}

export async function syncRepoAccess(
  installationId: string,
  repos: Omit<CreateRepoAccessInput, 'installationId'>[]
): Promise<void> {
  // Get current repo access for this installation
  const currentAccess = await prisma.repoAccess.findMany({
    where: { installationId },
    select: { repoId: true },
  });

  const currentRepoIds = new Set(currentAccess.map((a) => a.repoId));
  const newRepoIds = new Set(repos.map((r) => r.repoId));

  // Delete repos that are no longer accessible
  const toDelete = [...currentRepoIds].filter((id) => !newRepoIds.has(id));
  if (toDelete.length > 0) {
    await prisma.repoAccess.deleteMany({
      where: {
        installationId,
        repoId: { in: toDelete },
      },
    });
  }

  // Upsert all current repos
  for (const repo of repos) {
    await upsertRepoAccess({ ...repo, installationId });
  }
}

// ============================================================================
// Proposal Operations
// ============================================================================

export interface CreateProposalInput {
  userId: string;
  repoFullName: string;
  prNumber: number;
  prUrl: string;
  title: string;
  status: string;
}

export async function createProposal(input: CreateProposalInput): Promise<Proposal> {
  return prisma.proposal.create({
    data: input,
  });
}

export async function findProposalByPR(repoFullName: string, prNumber: number): Promise<Proposal | null> {
  return prisma.proposal.findUnique({
    where: {
      repoFullName_prNumber: { repoFullName, prNumber },
    },
  });
}

export async function findProposalsByUser(userId: string): Promise<Proposal[]> {
  return prisma.proposal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findProposalsByRepo(
  userId: string,
  repoFullName: string
): Promise<Proposal[]> {
  return prisma.proposal.findMany({
    where: { userId, repoFullName },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateProposalStatus(
  repoFullName: string,
  prNumber: number,
  status: string
): Promise<Proposal | null> {
  return prisma.proposal.update({
    where: {
      repoFullName_prNumber: { repoFullName, prNumber },
    },
    data: { status },
  }).catch(() => null);
}
