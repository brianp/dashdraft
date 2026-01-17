'use client';

import { useState, useEffect } from 'react';
import { UX } from '@/lib/constants/ux-terms';
import type { Installation, Repository } from '@/lib/types/api';

interface RepoPickerProps {
  onClose: () => void;
  onSync: () => void;
}

export function RepoPicker({ onClose, onSync }: RepoPickerProps) {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<Installation | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch installations on mount
  useEffect(() => {
    fetchInstallations();
  }, []);

  // Fetch repos when installation changes
  useEffect(() => {
    if (selectedInstallation) {
      fetchReposForInstallation(selectedInstallation.id);
    }
  }, [selectedInstallation]);

  async function fetchInstallations() {
    try {
      setLoading(true);
      const response = await fetch('/api/installations');
      const data = await response.json();

      if (data.error) {
        setError(data.message);
        return;
      }

      setInstallations(data.data);
      if (data.data.length > 0) {
        setSelectedInstallation(data.data[0]);
      }
    } catch {
      setError('Failed to load installations');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReposForInstallation(installationId: number) {
    try {
      setLoading(true);
      const response = await fetch(`/api/repos/available?installation=${installationId}`);
      const data = await response.json();

      if (data.error) {
        setError(data.message);
        return;
      }

      setRepos(data.data || []);
    } catch {
      setError('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);

      const response = await fetch('/api/repos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      onSync();
      onClose();
    } catch {
      setError('Failed to sync repositories');
    } finally {
      setSyncing(false);
    }
  }

  if (loading && installations.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="card max-w-lg w-full mx-4">
          <p className="text-center text-[var(--muted)]">{UX.LOADING}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{UX.GRANT_ACCESS}</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {UX.CLOSE}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[var(--error)]/10 border border-[var(--error)] rounded text-sm text-[var(--error)]">
            {error}
          </div>
        )}

        {installations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--muted)] mb-4">
              No GitHub App installations found.
            </p>
            <a
              href="https://github.com/apps/dashdraft/installations/new"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Install GitHub App
            </a>
          </div>
        ) : (
          <>
            {/* Installation selector */}
            {installations.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm text-[var(--muted)] mb-2">
                  Select account
                </label>
                <select
                  value={selectedInstallation?.id ?? ''}
                  onChange={(e) => {
                    const inst = installations.find(
                      (i) => i.id === Number(e.target.value)
                    );
                    setSelectedInstallation(inst ?? null);
                  }}
                  className="w-full p-2 rounded border border-[var(--border)] bg-[var(--background)]"
                >
                  {installations.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.accountLogin} ({inst.accountType})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Repo list */}
            <div className="flex-1 overflow-auto mb-4 border border-[var(--border)] rounded">
              {loading ? (
                <p className="p-4 text-center text-[var(--muted)]">{UX.LOADING}</p>
              ) : repos.length === 0 ? (
                <p className="p-4 text-center text-[var(--muted)]">
                  No repositories found for this installation.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {repos.map((repo) => (
                    <li key={repo.id} className="p-3 hover:bg-[var(--border)]/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{repo.name}</span>
                          {repo.isPrivate && (
                            <span className="ml-2 text-xs px-2 py-0.5 rounded bg-[var(--muted)]/20 text-[var(--muted)]">
                              Private
                            </span>
                          )}
                        </div>
                      </div>
                      {repo.description && (
                        <p className="text-sm text-[var(--muted)] mt-1 truncate">
                          {repo.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="btn btn-secondary">
                {UX.CANCEL}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn btn-primary"
              >
                {syncing ? 'Syncing...' : 'Sync repositories'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
