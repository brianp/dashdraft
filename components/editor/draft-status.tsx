'use client';

import type { DraftStatus } from '@/lib/types/api';
import { UX } from '@/lib/constants/ux-terms';

interface DraftStatusProps {
  status: DraftStatus;
  lastSaved?: Date;
}

export function DraftStatusBadge({ status, lastSaved }: DraftStatusProps) {
  const statusConfig = {
    clean: {
      label: 'Saved',
      className: 'text-[var(--success)]',
    },
    dirty: {
      label: UX.DRAFT,
      className: 'text-[var(--warning)]',
    },
    autosaved: {
      label: UX.AUTOSAVED,
      className: 'text-[var(--muted)]',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={config.className}>{config.label}</span>
      {lastSaved && (
        <span className="text-[var(--muted)]">
          {formatLastSaved(lastSaved)}
        </span>
      )}
    </div>
  );
}

function formatLastSaved(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 5) {
    return 'just now';
  }
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }

  return date.toLocaleDateString();
}
