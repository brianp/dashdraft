import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Enforce consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      // No unused variables (error level)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Prefer const
      'prefer-const': 'error',
      // No console in production code (warn to allow during development)
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      // Enforce explicit return types on module boundaries
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    // Test files have relaxed rules
    files: ['**/*.test.ts', '**/*.test.tsx', 'test/**/*'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
