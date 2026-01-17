import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 *
 * In development, we store the client on globalThis to prevent
 * multiple instances during hot reload.
 *
 * In production, we create a single instance.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
