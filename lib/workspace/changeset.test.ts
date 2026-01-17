import { describe, it, expect } from 'vitest';
import {
  createChangeset,
  validateChangeset,
  isEmptyChangeset,
  getChangesetStats,
} from './changeset';
import type { WorkspaceState } from './state';
import type { RepoConfig } from '@/lib/types/api';

const defaultConfig: RepoConfig = {
  docsRoot: 'docs',
  assetsDir: 'assets',
  allowedExtensions: ['.md', '.mdx'],
  allowPaths: ['**/*.md', '**/*.mdx'],
  isInferred: true,
};

function createTestWorkspace(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    repoFullName: 'testuser/test-repo',
    config: defaultConfig,
    files: new Map(),
    assets: new Map(),
    activeFile: null,
    ...overrides,
  };
}

describe('createChangeset', () => {
  it('should create empty changeset for clean workspace', () => {
    const state = createTestWorkspace();
    const changeset = createChangeset(state);

    expect(changeset.repoFullName).toBe('testuser/test-repo');
    expect(Object.keys(changeset.modified)).toHaveLength(0);
    expect(Object.keys(changeset.created)).toHaveLength(0);
    expect(changeset.deleted).toHaveLength(0);
    expect(changeset.assets).toHaveLength(0);
  });

  it('should include modified files', () => {
    const state = createTestWorkspace({
      files: new Map([
        [
          'docs/guide.md',
          {
            path: 'docs/guide.md',
            originalContent: 'original',
            originalSha: 'abc123',
            currentContent: 'modified',
            status: 'dirty',
            lastModified: new Date(),
            isNew: false,
          },
        ],
      ]),
    });

    const changeset = createChangeset(state);

    expect(Object.keys(changeset.modified)).toHaveLength(1);
    expect(changeset.modified['docs/guide.md']).toBe('modified');
  });

  it('should include new files', () => {
    const state = createTestWorkspace({
      files: new Map([
        [
          'docs/new-file.md',
          {
            path: 'docs/new-file.md',
            originalContent: '',
            originalSha: '',
            currentContent: '# New File',
            status: 'dirty',
            lastModified: new Date(),
            isNew: true,
          },
        ],
      ]),
    });

    const changeset = createChangeset(state);

    expect(Object.keys(changeset.created)).toHaveLength(1);
    expect(changeset.created['docs/new-file.md']).toBe('# New File');
  });

  it('should include new assets', () => {
    const state = createTestWorkspace({
      assets: new Map([
        [
          'docs/assets/image.png',
          {
            path: 'docs/assets/image.png',
            mimeType: 'image/png',
            size: 1024,
            isNew: true,
          },
        ],
      ]),
    });

    const changeset = createChangeset(state);

    expect(changeset.assets).toHaveLength(1);
    expect(changeset.assets[0]).toBe('docs/assets/image.png');
  });
});

describe('validateChangeset', () => {
  it('should reject empty changeset', () => {
    const changeset = {
      repoFullName: 'testuser/test-repo',
      modified: {},
      created: {},
      deleted: [],
      assets: [],
    };

    const result = validateChangeset(changeset);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('No changes to propose');
  });

  it('should accept valid changeset', () => {
    const changeset = {
      repoFullName: 'testuser/test-repo',
      modified: { 'docs/guide.md': 'content' },
      created: {},
      deleted: [],
      assets: [],
    };

    const result = validateChangeset(changeset);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid paths', () => {
    const changeset = {
      repoFullName: 'testuser/test-repo',
      modified: { '../../../etc/passwd': 'malicious' },
      created: {},
      deleted: [],
      assets: [],
    };

    const result = validateChangeset(changeset);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid file path'))).toBe(true);
  });

  it('should warn about large changesets', () => {
    const modified: Record<string, string> = {};
    for (let i = 0; i < 25; i++) {
      modified[`docs/file-${i}.md`] = 'content';
    }

    const changeset = {
      repoFullName: 'testuser/test-repo',
      modified,
      created: {},
      deleted: [],
      assets: [],
    };

    const result = validateChangeset(changeset);

    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('Large changeset'))).toBe(true);
  });
});

describe('isEmptyChangeset', () => {
  it('should return true for empty changeset', () => {
    const changeset = {
      repoFullName: 'testuser/test-repo',
      modified: {},
      created: {},
      deleted: [],
      assets: [],
    };

    expect(isEmptyChangeset(changeset)).toBe(true);
  });

  it('should return false for changeset with modifications', () => {
    const changeset = {
      repoFullName: 'testuser/test-repo',
      modified: { 'file.md': 'content' },
      created: {},
      deleted: [],
      assets: [],
    };

    expect(isEmptyChangeset(changeset)).toBe(false);
  });
});

describe('getChangesetStats', () => {
  it('should calculate correct stats', () => {
    const changeset = {
      repoFullName: 'testuser/test-repo',
      modified: {
        'file1.md': 'modified content 1',
        'file2.md': 'modified content 2',
      },
      created: {
        'new-file.md': 'new content',
      },
      deleted: ['deleted.md'],
      assets: ['image.png'],
    };

    const stats = getChangesetStats(changeset);

    expect(stats.modifiedCount).toBe(2);
    expect(stats.createdCount).toBe(1);
    expect(stats.deletedCount).toBe(1);
    expect(stats.assetCount).toBe(1);
    expect(stats.totalFiles).toBe(4);
    expect(stats.totalContentSize).toBeGreaterThan(0);
  });
});
