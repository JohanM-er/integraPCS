// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [// Ignore common build and dependency folders
{ ignores: ['dist', 'node_modules', 'coverage', '.storybook-static', 'playwright-report', 'test-results', 'build'] }, // Node/config files (e.g., Vite, Playwright, scripts)
{
  files: [
    '*.config.{js,ts}',
    'scripts/*.{js,ts}',
    'playwright.config.ts',
    'tests/setup.ts',
    '.storybook/**/*.{js,ts,tsx}'
  ],
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2020,
    globals: {
      ...globals.node
    },
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      project: './tsconfig.node.json',
      tsconfigRootDir: __dirname
    }
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
    prettier: prettierPlugin,
    import: importPlugin
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.eslint.json'],
        alwaysTryTypes: true
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts']
      }
    }
  },
  rules: {
    ...js.configs.recommended.rules,
    ...tsPlugin.configs.recommended.rules,
    ...prettierConfig.rules,
    'prettier/prettier': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',

    // Import ordering and hygiene
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'type'
        ],
        pathGroups: [
          { pattern: '@/**', group: 'internal', position: 'after' },
          { pattern: '@integrapcs/**', group: 'internal', position: 'after' }
        ],
        pathGroupsExcludedImportTypes: ['type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ],
    'import/no-duplicates': 'error',
    'import/no-cycle': ['error', { maxDepth: 3 }],
    'import/no-self-import': 'error',
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: ['**/../../**', '**/../../../**'],
            message:
              'Deep relative imports (../../) should be avoided. Use the @ alias.'
          }
        ]
      }
    ]
  }
}, // JavaScript/JSX files
{
  files: ['**/*.{js,jsx}'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
    parserOptions: {
      ecmaVersion: 'latest',
      ecmaFeatures: { jsx: true },
      sourceType: 'module'
    }
  },
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    prettier: prettierPlugin,
    'jsx-a11y': jsxA11y
  },
  rules: {
    ...js.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    ...(jsxA11y.configs?.recommended?.rules || {}),
    ...prettierConfig.rules, // disable conflicting ESLint rules
    'prettier/prettier': 'warn',
    'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
  }
}, // TypeScript/TSX files (source code only, excluding config/test files)
{
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
      project: './tsconfig.eslint.json',
      tsconfigRootDir: __dirname
    },
    globals: {
      ...globals.browser,
      JSX: 'readonly'
    }
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    prettier: prettierPlugin,
    'jsx-a11y': jsxA11y,
    import: importPlugin
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json'],
        alwaysTryTypes: true
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.d.ts']
      }
    }
  },
  rules: {
    ...tsPlugin.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    ...(jsxA11y.configs?.recommended?.rules || {}),
    ...prettierConfig.rules,
    'prettier/prettier': 'warn',

    // Stricter TypeScript rules
    '@typescript-eslint/no-unused-vars': [
      'error',
      { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    'prefer-const': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',

    // Discourage inline styles in JSX; prefer tokens + CVA variants
    'no-restricted-syntax': [
      'warn',
      {
        selector: 'JSXAttribute[name.name="style"]',
        message:
          'Avoid inline style={...} in JSX. Prefer design tokens (Tailwind utilities) and CVA variants (see frontend/src/lib/cva.ts and docs/UI system/UI_Design_System_Enforcement.md). For legitimate exceptions (e.g., canvas/charts/third-party), use an ESLint disable comment with a brief rationale.'
      }
    ],

    // React hooks discipline
    'react-hooks/exhaustive-deps': 'error',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

    // Disable no-undef for TypeScript (TypeScript compiler handles this better)
    'no-undef': 'off',

    // Import ordering and hygiene
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
          'type'
        ],
        pathGroups: [
          { pattern: '@/**', group: 'internal', position: 'after' },
          { pattern: '@integrapcs/**', group: 'internal', position: 'after' }
        ],
        pathGroupsExcludedImportTypes: ['type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ],
    'import/no-duplicates': 'error',
    'import/no-cycle': ['error', { maxDepth: 3 }],
    'import/no-self-import': 'error',
    'no-restricted-imports': [
      'warn',
      {
        patterns: [
          {
            group: ['**/../../**', '**/../../../**'],
            message:
              'Deep relative imports (../../) should be avoided. Use the @ alias.'
          }
        ]
      }
    ]
  }
}, // Test files (Vitest + Playwright)
{
  files: [
    'src/**/*.test.{js,jsx,ts,tsx}',
    'src/**/*.spec.{js,jsx,ts,tsx}',
    'tests/**/*.{js,jsx,ts,tsx}',
    'tests/**/*.spec.ts'
  ],
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.jest,
      ...globals.node,
      vi: 'readonly',
      expect: 'readonly',
      test: 'readonly',
      page: 'readonly'
    }
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off'
  }
}, ...storybook.configs["flat/recommended"]];
