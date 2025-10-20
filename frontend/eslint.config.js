import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tailwindPlugin from 'eslint-plugin-tailwindcss';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  // Ignore common build and dependency folders
  { ignores: ['dist', 'node_modules'] },

  // Node/config files (e.g., Vite, Playwright, scripts)
  {
    files: ['*.config.{js,ts}', 'scripts/*.{js,ts}', 'playwright.config.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      ...js.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'warn'
    }
  },

  // JavaScript/JSX files
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
      tailwindcss: tailwindPlugin,
      'jsx-a11y': jsxA11y
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...(jsxA11y.configs?.recommended?.rules || {}),
      ...prettierConfig.rules, // disable conflicting ESLint rules
      'prettier/prettier': 'warn',
      'no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }
      ],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],
      // Tailwind guardrails
      'tailwindcss/no-arbitrary-value': 'error',
      'tailwindcss/no-custom-classname': ['error', { whitelist: [] }],
      'tailwindcss/classnames-order': 'warn'
    }
  },

  // TypeScript/TSX files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        project: true, // auto-detect tsconfig.json
        tsconfigRootDir: './'
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
      tailwindcss: tailwindPlugin,
      'jsx-a11y': jsxA11y
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

      // React hooks discipline
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],

      // Environment
      'no-undef': 'error',

      // Tailwind guardrails
      'tailwindcss/no-arbitrary-value': 'error',
      'tailwindcss/no-custom-classname': ['error', { whitelist: [] }],
      'tailwindcss/classnames-order': 'warn'
    }
  },

  // Test files (Vitest + Playwright)
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
  }
];