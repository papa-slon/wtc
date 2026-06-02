// ESLint 9 flat config for the WTC monorepo (TS + React/TSX). Type-aware linting is intentionally
// NOT enabled (no parserOptions.project) so lint is fast and works across all workspaces; tsc handles
// type errors separately.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.next-e2e/**',
      '**/.next-e2e-auth/**',
      '**/.next-e2e-auth-db/**',
      '**/.next-e2e-db/**',
      '**/out/**',
      '**/build/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/pgdata/**',
      '**/next-env.d.ts',
      'packages/db/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // tsc owns undefined-symbol checking for TS.
      'no-undef': 'off',
      // Deliberate, narrow casts exist (globalThis singletons, env parsing); not worth blocking lint.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Node ESM tooling scripts (e.g. scripts/check-governance.mjs). Node globals; tsc does not cover .mjs.
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-undef': 'off' },
  },
);
