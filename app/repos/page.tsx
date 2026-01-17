'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { UX } from '@/lib/constants/ux-terms';
import { RepoPicker } from '@/components/repo-picker';
import { Logo } from '@/components/logo';
import type { EnabledRepository } from '@/lib/types/api';

export default function ReposPage() {
  const [repos, setRepos] = useState<EnabledRepository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const fetchRepos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/repos');
      const data = await response.json();

      if (data.error) {
        setError(data.message);
        return;
      }

      setRepos(data.data);
    } catch {
      setError('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepos();
  }, [fetchRepos]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{UX.ENABLED_REPOS}</h1>
          <button
            onClick={() => setShowPicker(true)}
            className="btn btn-primary"
          >
            {UX.GRANT_ACCESS}
          </button>
        </div>

        {error && (
          <div className="card mb-6 border-[var(--error)] bg-[var(--error)]/10">
            <p className="text-[var(--error)]">{error}</p>
            <button
              onClick={fetchRepos}
              className="mt-2 text-sm underline hover:no-underline"
            >
              {UX.TRY_AGAIN}
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[var(--muted)]">{UX.LOADING}</p>
          </div>
        ) : repos.length === 0 ? (
          <EmptyState onGrantAccess={() => setShowPicker(true)} />
        ) : (
          <RepoList repos={repos} />
        )}

        {showPicker && (
          <RepoPicker
            onClose={() => setShowPicker(false)}
            onSync={fetchRepos}
          />
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Logo size="sm" />
        <nav className="flex items-center gap-4">
          <Link
            href="/repos"
            className="text-sm text-[var(--foreground)] font-medium"
          >
            {UX.WORKSPACE}
          </Link>
          <a
            href="/api/auth/logout"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {UX.SIGN_OUT}
          </a>
        </nav>
      </div>
    </header>
  );
}

function EmptyState({ onGrantAccess }: { onGrantAccess: () => void }) {
  return (
    <div className="card text-center py-12">
      <h2 className="text-lg font-semibold mb-2">No repositories enabled</h2>
      <p className="text-[var(--muted)] mb-6">
        Grant access to repositories where you want to edit documentation.
      </p>
      <button onClick={onGrantAccess} className="btn btn-primary">
        {UX.GRANT_ACCESS}
      </button>
    </div>
  );
}

function RepoList({ repos }: { repos: EnabledRepository[] }) {
  return (
    <div className="grid gap-4">
      {repos.map((repo) => (
        <Link
          key={repo.id}
          href={`/repo/${repo.fullName}`}
          className="card hover:border-[var(--primary)] transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{repo.fullName}</h3>
              {repo.description && (
                <p className="text-sm text-[var(--muted)] mt-1">
                  {repo.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {repo.isPrivate && (
                <span className="text-xs px-2 py-1 rounded bg-[var(--muted)]/20 text-[var(--muted)]">
                  Private
                </span>
              )}
              <span className="text-[var(--muted)]">&rarr;</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
