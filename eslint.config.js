import nxPlugin from '@nx/eslint-plugin';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.nx/**',
      '**/generated/**',
      '**/storybook-static/**',
      'storybook-static/**'
    ]
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@nx': nxPlugin
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            { sourceTag: 'layer:domain', onlyDependOnLibsWithTags: ['scope:shared', 'layer:domain'] },
            { sourceTag: 'layer:application', onlyDependOnLibsWithTags: ['scope:shared', 'layer:domain', 'layer:application', 'scope:platform'] },
            { sourceTag: 'layer:infrastructure', onlyDependOnLibsWithTags: ['scope:shared', 'layer:domain', 'layer:application', 'layer:infrastructure', 'scope:platform'] },
            { sourceTag: 'layer:interfaces', onlyDependOnLibsWithTags: ['scope:shared', 'layer:application', 'layer:interfaces', 'scope:platform'] },
            { sourceTag: 'scope:platform', onlyDependOnLibsWithTags: ['scope:shared', 'scope:platform'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
            { sourceTag: 'scope:app', onlyDependOnLibsWithTags: ['scope:context:work-package', 'scope:platform', 'scope:shared', 'scope:package', 'scope:app'] }
          ]
        }
      ]
    }
  }
];