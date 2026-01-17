import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  isPathWithinBase,
  matchesAllowedPath,
  validateRepoFullName,
  parseRepoFullName,
  validateAsset,
  validateMarkdownContent,
} from './validate';

describe('normalizePath', () => {
  it('should normalize simple paths', () => {
    expect(normalizePath('docs/guide.md')).toBe('docs/guide.md');
    expect(normalizePath('file.md')).toBe('file.md');
  });

  it('should remove redundant segments', () => {
    expect(normalizePath('docs/./guide.md')).toBe('docs/guide.md');
    expect(normalizePath('./docs/guide.md')).toBe('docs/guide.md');
  });

  it('should reject traversal attempts', () => {
    expect(normalizePath('../etc/passwd')).toBeNull();
    expect(normalizePath('docs/../../../etc/passwd')).toBeNull();
    expect(normalizePath('docs/..%2f..%2fetc/passwd')).toBeNull();
  });

  it('should reject absolute paths', () => {
    expect(normalizePath('/etc/passwd')).toBeNull();
    expect(normalizePath('C:/Windows/System32')).toBeNull();
  });

  it('should reject null bytes', () => {
    expect(normalizePath('docs/file\0.md')).toBeNull();
  });

  it('should reject invalid characters', () => {
    expect(normalizePath('docs/file<script>.md')).toBeNull();
    expect(normalizePath('docs/file|pipe.md')).toBeNull();
  });
});

describe('isPathWithinBase', () => {
  it('should return true for paths within base', () => {
    expect(isPathWithinBase('docs/guide.md', 'docs')).toBe(true);
    expect(isPathWithinBase('docs/nested/deep.md', 'docs')).toBe(true);
  });

  it('should return false for paths outside base', () => {
    expect(isPathWithinBase('other/file.md', 'docs')).toBe(false);
    expect(isPathWithinBase('file.md', 'docs')).toBe(false);
  });

  it('should handle empty base (root allowed)', () => {
    expect(isPathWithinBase('any/path.md', '')).toBe(true);
    expect(isPathWithinBase('file.md', '')).toBe(true);
  });
});

describe('matchesAllowedPath', () => {
  it('should match simple patterns', () => {
    expect(matchesAllowedPath('file.md', ['*.md'])).toBe(true);
    expect(matchesAllowedPath('file.txt', ['*.md'])).toBe(false);
  });

  it('should match glob patterns', () => {
    expect(matchesAllowedPath('docs/guide.md', ['**/*.md'])).toBe(true);
    expect(matchesAllowedPath('docs/nested/deep.md', ['**/*.md'])).toBe(true);
  });

  it('should match multiple patterns', () => {
    expect(matchesAllowedPath('file.md', ['*.md', '*.mdx'])).toBe(true);
    expect(matchesAllowedPath('file.mdx', ['*.md', '*.mdx'])).toBe(true);
    expect(matchesAllowedPath('file.txt', ['*.md', '*.mdx'])).toBe(false);
  });
});

describe('validateRepoFullName', () => {
  it('should accept valid repo names', () => {
    expect(validateRepoFullName('owner/repo')).toBe('owner/repo');
    expect(validateRepoFullName('my-org/my-repo')).toBe('my-org/my-repo');
    expect(validateRepoFullName('User123/Repo_456')).toBe('user123/repo_456');
  });

  it('should reject invalid repo names', () => {
    expect(validateRepoFullName('invalid')).toBeNull();
    expect(validateRepoFullName('owner/repo/extra')).toBeNull();
    expect(validateRepoFullName('/repo')).toBeNull();
    expect(validateRepoFullName('owner/')).toBeNull();
    expect(validateRepoFullName('')).toBeNull();
  });

  it('should reject overly long names', () => {
    const longName = 'a'.repeat(100) + '/' + 'b'.repeat(100);
    expect(validateRepoFullName(longName)).toBeNull();
  });
});

describe('parseRepoFullName', () => {
  it('should parse valid repo names', () => {
    expect(parseRepoFullName('owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
    expect(parseRepoFullName('My-Org/My-Repo')).toEqual({ owner: 'my-org', repo: 'my-repo' });
  });

  it('should return null for invalid names', () => {
    expect(parseRepoFullName('invalid')).toBeNull();
    expect(parseRepoFullName('')).toBeNull();
  });
});

describe('validateAsset', () => {
  it('should accept valid image types', () => {
    expect(validateAsset('image/png', 1024)).toEqual({ valid: true });
    expect(validateAsset('image/jpeg', 1024)).toEqual({ valid: true });
    expect(validateAsset('image/gif', 1024)).toEqual({ valid: true });
  });

  it('should reject invalid types', () => {
    const result = validateAsset('application/pdf', 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should reject files that are too large', () => {
    const result = validateAsset('image/png', 10 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });
});

describe('validateMarkdownContent', () => {
  it('should accept valid content', () => {
    const result = validateMarkdownContent('# Hello World\n\nThis is content.');
    expect(result.valid).toBe(true);
  });

  it('should reject content that is too large', () => {
    const largeContent = 'a'.repeat(2 * 1024 * 1024);
    const result = validateMarkdownContent(largeContent);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum');
  });

  it('should reject content with null bytes', () => {
    const result = validateMarkdownContent('Hello\0World');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });
});
