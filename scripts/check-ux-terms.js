#!/usr/bin/env node

/**
 * UX Terms Lint Script
 *
 * Scans UI files for forbidden Git terminology.
 * This ensures we maintain product-centric vocabulary throughout the application.
 *
 * Usage: npm run lint:ux-terms
 */

const fs = require('fs');
const path = require('path');

// Directories to scan (UI-facing code only)
const SCAN_DIRS = ['app', 'components'];

// File extensions to check
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

// Patterns to exclude (non-UI code)
const EXCLUDE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /__tests__/,
  /lib\/github/,  // GitHub API code may need to use these terms internally
  /lib\/constants\/ux-terms\.ts$/, // The terms file itself
];

// Forbidden terms (case insensitive)
const FORBIDDEN_TERMS = [
  'branch',
  'branches',
  'commit',
  'commits',
  'committed',
  'uncommitted',
  'SHA',
  'rebase',
  'rebasing',
  'merge',
  'merged',
  'merging',
  'pull request',
  'pull-request',
  'push(?:ed|ing)?',
  'fetch(?:ed|ing)?',
  'clone(?:d|ing)?',
  'checkout',
  'stash',
  'HEAD',
  'origin',
  'upstream',
  'remote',
  'diff',
  'patch',
  'cherry-pick',
  'squash',
  'amend',
  'force push',
  'staging area',
  'staged',
  'unstaged',
  'working tree',
  'working directory',
  'detached HEAD',
  'fast-forward',
];

// Contexts where terms are allowed (e.g., in comments explaining the mapping)
const ALLOWED_CONTEXTS = [
  /\/\*[\s\S]*?\*\//g,  // Multi-line comments
  /\/\/.*$/gm,          // Single-line comments
  /TERM_MAP/,           // The term mapping object
  /sanitizeErrorMessage/, // Error sanitization function
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function isAllowedContext(content, match, index) {
  // Check if the match is within a comment or allowed context
  const lineStart = content.lastIndexOf('\n', index) + 1;
  const lineEnd = content.indexOf('\n', index);
  const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

  // Check if it's in a comment
  if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
    return true;
  }

  // Check if it's in a string that's part of an allowed context
  const surroundingContext = content.slice(Math.max(0, index - 100), index + 100);
  return ALLOWED_CONTEXTS.some(pattern => pattern.test(surroundingContext));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];

  for (const term of FORBIDDEN_TERMS) {
    // Create case-insensitive regex, but avoid matching partial words
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!isAllowedContext(content, match[0], match.index)) {
        const lineNumber = content.slice(0, match.index).split('\n').length;
        violations.push({
          term: match[0],
          line: lineNumber,
          file: filePath,
        });
      }
    }
  }

  return violations;
}

function walkDir(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath, files);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (EXTENSIONS.includes(ext) && !shouldExclude(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function main() {
  const rootDir = process.cwd();
  let allViolations = [];

  for (const scanDir of SCAN_DIRS) {
    const dirPath = path.join(rootDir, scanDir);
    if (!fs.existsSync(dirPath)) {
      continue;
    }

    const files = walkDir(dirPath);
    for (const file of files) {
      const violations = scanFile(file);
      allViolations = allViolations.concat(violations);
    }
  }

  if (allViolations.length > 0) {
    console.error('\n❌ Found forbidden Git terminology in UI code:\n');

    for (const v of allViolations) {
      const relativePath = path.relative(rootDir, v.file);
      console.error(`  ${relativePath}:${v.line} - "${v.term}"`);
    }

    console.error('\n💡 Use product-centric terms instead (see lib/constants/ux-terms.ts)\n');
    process.exit(1);
  } else {
    console.log('✅ No forbidden Git terminology found in UI code');
    process.exit(0);
  }
}

main();
