import { describe, it, expect } from 'vitest';
import {
  computeAssetDestination,
  computeRelativePath,
  generateImageMarkdown,
  validateAssetFilename,
} from './pathing';
import type { RepoConfig } from '@/lib/types/api';

const defaultConfig: RepoConfig = {
  docsRoot: 'docs',
  assetsDir: 'assets',
  allowedExtensions: ['.md', '.mdx'],
  allowPaths: ['**/*.md', '**/*.mdx'],
  isInferred: true,
};

describe('computeAssetDestination', () => {
  it('should place asset in assets directory relative to docs root', () => {
    const result = computeAssetDestination(
      'screenshot.png',
      'docs/guide/intro.md',
      defaultConfig
    );
    expect(result).toBe('docs/assets/screenshot.png');
  });

  it('should sanitize filenames', () => {
    const result = computeAssetDestination(
      'My Image File.png',
      'docs/guide/intro.md',
      defaultConfig
    );
    expect(result).toBe('docs/assets/my-image-file.png');
  });

  it('should remove special characters', () => {
    const result = computeAssetDestination(
      'image@2x (copy).png',
      'docs/guide/intro.md',
      defaultConfig
    );
    expect(result).toBe('docs/assets/image2x-copy.png');
  });

  it('should handle root docsRoot', () => {
    const config: RepoConfig = {
      ...defaultConfig,
      docsRoot: '.',
    };
    const result = computeAssetDestination(
      'image.png',
      'readme.md',
      config
    );
    expect(result).toBe('assets/image.png');
  });
});

describe('computeRelativePath', () => {
  it('should compute relative path to sibling directory', () => {
    const result = computeRelativePath(
      'docs/assets/image.png',
      'docs/guide/intro.md'
    );
    expect(result).toBe('../assets/image.png');
  });

  it('should compute relative path to same directory', () => {
    const result = computeRelativePath(
      'docs/guide/image.png',
      'docs/guide/intro.md'
    );
    expect(result).toBe('./image.png');
  });

  it('should compute relative path from nested directory', () => {
    const result = computeRelativePath(
      'assets/image.png',
      'docs/guide/nested/deep.md'
    );
    expect(result).toBe('../../../assets/image.png');
  });

  it('should handle files in root', () => {
    const result = computeRelativePath(
      'assets/image.png',
      'readme.md'
    );
    expect(result).toBe('./assets/image.png');
  });
});

describe('generateImageMarkdown', () => {
  it('should generate markdown image syntax', () => {
    const result = generateImageMarkdown(
      'docs/assets/image.png',
      'docs/guide/intro.md',
      'Screenshot'
    );
    expect(result).toBe('![Screenshot](../assets/image.png)');
  });

  it('should handle empty alt text', () => {
    const result = generateImageMarkdown(
      'assets/image.png',
      'readme.md',
      ''
    );
    expect(result).toBe('![](./assets/image.png)');
  });
});

describe('validateAssetFilename', () => {
  it('should accept valid image extensions', () => {
    expect(validateAssetFilename('image.png')).toEqual({ valid: true });
    expect(validateAssetFilename('photo.jpg')).toEqual({ valid: true });
    expect(validateAssetFilename('animation.gif')).toEqual({ valid: true });
    expect(validateAssetFilename('icon.svg')).toEqual({ valid: true });
    expect(validateAssetFilename('image.webp')).toEqual({ valid: true });
  });

  it('should reject invalid extensions', () => {
    const result = validateAssetFilename('document.pdf');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should reject empty filename', () => {
    const result = validateAssetFilename('');
    expect(result.valid).toBe(false);
  });
});
