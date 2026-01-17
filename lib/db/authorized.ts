/**
 * Authorized Data Access Layer
 *
 * All database access for user-owned data MUST go through this layer.
 * This ensures queries are always scoped to the authenticated user.
 *
 * Usage in API routes:
 *   const user = await requireUser();
 *   const db = authorizedDb(user.id);
 *   const repos = await db.repos.findAll();  // Automatically scoped
 */

import { prisma } from './prisma';
import type { Installation, RepoAccess, Proposal } from '@prisma/client';

/**
 * Create a user-scoped database access object.
 * All queries through this object are automatically filtered by userId.
 */
export function authorizedDb(userId: string) {
  return {
    userId,

    installations: new AuthorizedInstallations(userId),
    repos: new AuthorizedRepos(userId),
    proposals: new AuthorizedProposals(userId),
  };
}

export type AuthorizedDb = ReturnType<typeof authorizedDb>;

// ============================================================================
// Installations
// ============================================================================

class AuthorizedInstallations {
  constructor(private userId: string) {}

  async findAll(): Promise<Installation[]> {
    return prisma.installation.findMany({
      where: { userId: this.userId },
      orderBy: { accountLogin: 'asc' },
    });
  }

  async findByInstallationId(installationId: number): Promise<Installation | null> {
    return prisma.installation.findFirst({
      where: {
        installationId,
        userId: this.userId,  // Must belong to this user
      },
    });
  }

  async upsert(data: {
    installationId: number;
    accountLogin: string;
    accountType: 'User' | 'Organization';
    accountAvatar: string;
  }): Promise<Installation> {
    // First check if this installation exists for another user
    const existing = await prisma.installation.findUnique({
      where: { installationId: data.installationId },
    });

    if (existing && existing.userId !== this.userId) {
      // Installation belongs to another user - don't allow takeover
      throw new AuthorizationError(
        'This installation is already linked to another account'
      );
    }

    return prisma.installation.upsert({
      where: { installationId: data.installationId },
      update: {
        accountLogin: data.accountLogin,
        accountType: data.accountType,
        accountAvatar: data.accountAvatar,
      },
      create: {
        ...data,
        userId: this.userId,
      },
    });
  }

  async delete(installationId: number): Promise<void> {
    // Only delete if it belongs to this user
    await prisma.installation.deleteMany({
      where: {
        installationId,
        userId: this.userId,
      },
    });
  }
}

// ============================================================================
// Repository Access
// ============================================================================

class AuthorizedRepos {
  constructor(private userId: string) {}

  async findAll(): Promise<(RepoAccess & { installation: Installation })[]> {
    return prisma.repoAccess.findMany({
      where: {
        installation: { userId: this.userId },
      },
      include: { installation: true },
      orderBy: { repoFullName: 'asc' },
    });
  }

  async findByFullName(
    repoFullName: string
  ): Promise<(RepoAccess & { installation: Installation }) | null> {
    return prisma.repoAccess.findFirst({
      where: {
        repoFullName,
        installation: { userId: this.userId },
      },
      include: { installation: true },
    });
  }

  /**
   * Check if user has access to a repo - returns installation ID if yes
   */
  async checkAccess(repoFullName: string): Promise<number | null> {
    const access = await this.findByFullName(repoFullName);
    return access?.installation.installationId ?? null;
  }

  /**
   * Require access to a repo - throws if not authorized
   */
  async requireAccess(repoFullName: string): Promise<{
    repoAccess: RepoAccess & { installation: Installation };
    installationId: number;
  }> {
    const access = await this.findByFullName(repoFullName);
    if (!access) {
      throw new AuthorizationError(
        `Access denied to repository: ${repoFullName}`
      );
    }
    return {
      repoAccess: access,
      installationId: access.installation.installationId,
    };
  }

  async syncForInstallation(
    installationId: number,
    repos: Array<{
      repoId: number;
      repoFullName: string;
      repoName: string;
      isPrivate: boolean;
    }>
  ): Promise<void> {
    // First verify this installation belongs to the user
    const installation = await prisma.installation.findFirst({
      where: {
        installationId,
        userId: this.userId,
      },
    });

    if (!installation) {
      throw new AuthorizationError(
        'Cannot sync repos for an installation you do not own'
      );
    }

    // Get current repos
    const currentRepos = await prisma.repoAccess.findMany({
      where: { installationId: installation.id },
      select: { repoId: true },
    });

    const currentIds = new Set(currentRepos.map((r) => r.repoId));
    const newIds = new Set(repos.map((r) => r.repoId));

    // Delete removed repos
    const toDelete = [...currentIds].filter((id) => !newIds.has(id));
    if (toDelete.length > 0) {
      await prisma.repoAccess.deleteMany({
        where: {
          installationId: installation.id,
          repoId: { in: toDelete },
        },
      });
    }

    // Upsert current repos
    for (const repo of repos) {
      await prisma.repoAccess.upsert({
        where: {
          installationId_repoId: {
            installationId: installation.id,
            repoId: repo.repoId,
          },
        },
        update: {
          repoFullName: repo.repoFullName,
          repoName: repo.repoName,
          isPrivate: repo.isPrivate,
        },
        create: {
          installationId: installation.id,
          repoId: repo.repoId,
          repoFullName: repo.repoFullName,
          repoName: repo.repoName,
          isPrivate: repo.isPrivate,
        },
      });
    }
  }
}

// ============================================================================
// Proposals
// ============================================================================

class AuthorizedProposals {
  constructor(private userId: string) {}

  async findAll(): Promise<Proposal[]> {
    return prisma.proposal.findMany({
      where: { userId: this.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByRepo(repoFullName: string): Promise<Proposal[]> {
    return prisma.proposal.findMany({
      where: {
        userId: this.userId,
        repoFullName,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByPR(repoFullName: string, prNumber: number): Promise<Proposal | null> {
    return prisma.proposal.findFirst({
      where: {
        userId: this.userId,
        repoFullName,
        prNumber,
      },
    });
  }

  async create(data: {
    repoFullName: string;
    prNumber: number;
    prUrl: string;
    title: string;
    status: string;
  }): Promise<Proposal> {
    return prisma.proposal.create({
      data: {
        ...data,
        userId: this.userId,
      },
    });
  }

  async updateStatus(
    repoFullName: string,
    prNumber: number,
    status: string
  ): Promise<Proposal | null> {
    // Only update if it belongs to this user
    const existing = await this.findByPR(repoFullName, prNumber);
    if (!existing) {
      return null;
    }

    return prisma.proposal.update({
      where: { id: existing.id },
      data: { status },
    });
  }
}

// ============================================================================
// Errors
// ============================================================================

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
