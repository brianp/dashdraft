'use client';

import type { ProposalStatus } from '@/lib/types/api';
import { UX } from '@/lib/constants/ux-terms';

interface StatusBadgeProps {
  status: ProposalStatus;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<
  ProposalStatus,
  { label: string; className: string; icon: string }
> = {
  pending: {
    label: UX.PROPOSAL_PENDING,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    icon: '⏳',
  },
  approved: {
    label: UX.PROPOSAL_APPROVED,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    icon: '✓',
  },
  published: {
    label: UX.PROPOSAL_PUBLISHED,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    icon: '✓',
  },
  closed: {
    label: UX.PROPOSAL_CLOSED,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    icon: '✕',
  },
  conflict: {
    label: UX.CONFLICT_TITLE,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    icon: '⚠',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full font-medium
        ${config.className}
        ${SIZE_CLASSES[size]}
      `}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

/**
 * Large status display with description
 */
interface StatusDisplayProps {
  status: ProposalStatus;
  message?: string;
}

export function StatusDisplay({ status, message }: StatusDisplayProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className={`rounded-lg p-4 ${config.className}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{config.icon}</span>
        <span className="font-semibold">{config.label}</span>
      </div>
      {message && <p className="text-sm opacity-90">{message}</p>}
    </div>
  );
}
