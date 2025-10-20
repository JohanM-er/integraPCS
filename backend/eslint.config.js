const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');

module.exports = [
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '*.js', // Ignore JS files in backend (we're using TypeScript)
      'scripts/**/*.js', // Allow JS in scripts folder (ignored by ESLint)
      '**/*.test.ts', // Test files have different rules
      '**/*.spec.ts'
    ]
  },

  // TypeScript configuration for backend
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: '.'
      },
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts']
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json'
        },
        node: {
          extensions: ['.ts', '.js', '.json']
        }
      }
    },
    rules: {
      // TypeScript recommended rules
      ...tsPlugin.configs.recommended.rules,

      // TypeScript strict rules
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'warn',

      // Prevent require() imports
      '@typescript-eslint/no-require-imports': 'error',
      'import/no-commonjs': [
        'error',
        {
          allowRequire: false,
          allowConditionalRequire: false
        }
      ],

      // Avoid generic Function type
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSTypeReference[typeName.name="Function"]',
          message:
            'Avoid using the generic `Function` type. Use a specific function signature like `(...args: any[]) => any` instead.'
        }
      ],

      // TS comment enforcement
      '@typescript-eslint/prefer-ts-expect-error': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description',
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10
        }
      ],

      // Import organization rules
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
            {
              pattern: '@integrapcs/**',
              group: 'internal',
              position: 'after'
            },
            {
              pattern: '@core/**',
              group: 'internal',
              position: 'after'
            },
            {
              pattern: '@features/**',
              group: 'internal',
              position: 'after'
            }
          ],
          pathGroupsExcludedImportTypes: ['type'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          }
        }
      ],
      'import/no-duplicates': 'error',
      'import/no-cycle': ['error', { maxDepth: 3 }],
      'import/no-self-import': 'error',

      // Warn on deep relative imports
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['**/../../**'],
              message:
                'Deep relative imports (../../) should be avoided. Consider using path aliases.'
            }
          ]
        }
      ],

      // Backend-specific rules
      'no-console': [
        'error',
        {
          allow: ['warn', 'error']
        }
      ],

      // Async/await patterns
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      // Code quality rules
      'max-lines': [
        'warn',
        {
          max: 300,
          skipBlankLines: true,
          skipComments: true
        }
      ],
      complexity: ['warn', { max: 15 }],
      'max-depth': ['warn', { max: 4 }],
      'max-nested-callbacks': ['warn', { max: 3 }],
      'max-params': ['warn', { max: 5 }],

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow'
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow'
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow'
        },
        {
          selector: 'typeLike',
          format: ['PascalCase']
        },
        {
          selector: 'enumMember',
          format: ['UPPER_CASE']
        },
        {
          selector: 'property',
          format: null
        }
      ],

      // Error handling
      '@typescript-eslint/only-throw-error': 'error',

      // Best practices
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'warn',
      'prefer-template': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-assign': 'error',
      'no-sequences': 'error',
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true
        }
      ],

      // TODO comments must have context
      'no-warning-comments': [
        'warn',
        {
          terms: ['TODO', 'FIXME', 'HACK'],
          location: 'start'
        }
      ],

      // Additional preventive rules
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Memory leak prevention
      'no-global-assign': 'error',
      'no-implicit-globals': 'error'
    }
  },

  // Test file overrides
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'max-lines': 'off',
      'max-nested-callbacks': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },

  // Migration/Legacy file overrides (optional leniency)
  {
    files: ['**/dal/*.ts', '**/services/*.ts', '**/handlers/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      'max-lines': ['warn', { max: 500 }],
      complexity: ['warn', { max: 20 }],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error']
        }
      ]
    }
  }
];