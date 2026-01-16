# integraPCS Blueprint — Greenfield Setup Guide (v2)

This playbook bootstraps a fresh, event-sourced DDD monorepo that mirrors the integraPCS architecture and toolchain. It codifies the repo’s ESM posture, Nx expectations, quality gates, DevOps workflow, and the operational guardrails that routinely trip up new teams. Follow every step in order; skipping ahead usually surfaces as Husky failures, TypeScript build breaks, or CI regressions.

---

## 1. Workstation Prerequisites

1. Runtime & package manager
   - Install Node.js ≥ 22.22.0 (LTS, ensures ES2023 libs, stable `fetch`, native WebSocket client, and V8 12.4 performance improvements).
   - Enable Corepack and pin pnpm 9.0.0:
     ```bash
     corepack enable
     corepack prepare pnpm@9.0.0 --activate
     ```
     (Run these commands once per machine; avoid invoking `corepack prepare` in every dev script.)
   - Provide `.nvmrc` and `.node-version` files with `22.22.0` to keep the team aligned.
2. Tooling
   - `git`, `gh` (optional), `jq`.
   - **Container runtime** (for Neo4j/Redis/RabbitMQ) — choose one:
     - **OrbStack** (recommended for macOS): Lightweight Docker Desktop alternative with better performance
       ```bash
       brew install orbstack
       # Start OrbStack
       orbctl start
       # Verify Docker context is set
       docker context list  # Should show "orbstack" as current
       ```
     - **Docker Desktop**: Traditional option, works on macOS/Windows/Linux
       ```bash
       # macOS
       brew install --cask docker
       # Start Docker Desktop from Applications
       ```
   - `nx` CLI (invoked via `pnpm dlx nx`).
3. Editor configuration
   - Enable Prettier with Tailwind sorting, ESLint flat config support, Stylelint, Nx Console.
   - Configure EditorConfig support (VS Code, JetBrains).
   - Check in `.vscode/settings.json` with `"typescript.tsdk": "node_modules/typescript/lib"` and format-on-save enabled to avoid editor drift.

> Foot-gun: Node < 22.x fails Husky typecheck hooks and `pnpm install` due to `engine-strict`. Validate with `node -v` before proceeding. Note: Node 22 uses `import with` syntax for JSON modules (e.g., `import data from './data.json' with { type: 'json' }`).

---

## 2. Repository Bootstrap

1. Start the git workspace
   ```bash
   mkdir integrapcs-blueprint && cd integrapcs-blueprint
   git init
   ```
2. Initialize package metadata (ESM-first)
   ```bash
   pnpm init -y
   pnpm pkg set name="integrapcs-monorepo" private=true description="DDD+ES monorepo scaffold"
   pnpm pkg set version="0.0.0" type="module"
   pnpm pkg set packageManager="pnpm@9.0.0"
   pnpm pkg set engines.node=">=22"
   pnpm pkg set scripts.prepare="husky install"
   ```
3. Baseline `.npmrc`
   ```
   engine-strict=true
   auto-install-peers=true
   prefer-workspace-packages=true
   shared-workspace-lockfile=true
   ```
4. Install workspace-wide dev dependencies
   ```bash
   pnpm add -D \
     nx@22.3.3 @nx/node@22.3.3 @nx/react@22.3.3 @nx/vite@22.3.3 \
     @nx/playwright@22.3.3 @nx/storybook@22.3.3 @nx/js@22.3.3 \
     @nx/eslint-plugin@22.3.3 @nx/vitest@22.3.3 \
     typescript@5.9.3 tsc-alias@1.8.8 \
     prettier@3.8.0 prettier-plugin-tailwindcss@0.6.14 \
     eslint@9.22.0 eslint-plugin-react@7.34.2 \
     @typescript-eslint/parser@8.34.0 @typescript-eslint/eslint-plugin@8.34.0 \
     eslint-plugin-jsx-a11y@6.8.0 eslint-config-prettier@10.0.0 \
     eslint-plugin-import@2.32.0 eslint-import-resolver-typescript@4.4.4 \
     stylelint@16.26.1 stylelint-config-recommended@14.0.1 stylelint-config-tailwindcss@1.0.1 \
     lint-staged@15.2.7 husky@9.1.7 chalk@5.6.2 glob@11.1.0 jiti@2.4.2 \
     dotenv-safe@9.0.0 zod@3.25.56 \
     @graphql-codegen/cli@5.0.4 @graphql-codegen/client-preset@4.5.0 \
     @graphql-codegen/typescript@4.1.0 @graphql-codegen/typescript-operations@4.1.0 \
     ts-prune@0.11.7 \
     vitest@4.0.0 @vitest/ui@4.0.0 @vitest/coverage-v8@4.0.0
   ```
5. Adopt Nx preset
   ```bash
   pnpm nx init
   ```
6. Commit baseline (keeps diffs reviewable)
   ```bash
   git add . && git commit -m "chore: nx workspace bootstrap"
   ```

---

## 3. Workspace Layout & pnpm Workspaces

1. Directory scaffold
   ```bash
   mkdir -p \
     apps/api apps/jobs/{outbox-publisher,projection-consumer} apps/web \
     libs/contexts/work-package/{domain,application,infrastructure,interfaces/graphql} \
     libs/platform/{auth,config,db,graphql,messaging,observability,security} \
     libs/shared/{kernel,patterns,common} \
     packages/{design-tokens,shared-types} \
     scripts/{build,config,validate} \
     docs "docs/UI system" \
     .github/workflows local/seeds spikes/prototypes
   ```
2. pnpm workspace declaration (`pnpm-workspace.yaml`)
   ```yaml
   packages:
     - apps/*
     - backend
     - frontend
     - contexts/*
     - platform/*
     - shared/*
     - packages/*
     - spikes/*
   ```
   > Note: If you have standalone `frontend/` or `backend/` directories outside `apps/`, list them explicitly. pnpm will not auto-discover them from npm `workspaces` in package.json.
3. Nx workspace layout (`nx.json`)
   ```json
   {
     "extends": "nx/presets/npm.json",
     "namedInputs": {
       "default": ["{projectRoot}/**/*", "!{projectRoot}/generated/**/*"]
     },
    "targetDefaults": {
      "build": { "cache": true },
      "test": { "cache": true },
      "lint": { "cache": true },
      "typecheck": {
        "cache": true,
        "inputs": ["default", "^default"]
      }
    },
     "workspaceLayout": {
       "appsDir": "apps",
       "libsDir": "libs"
     }
   }
   ```
4. Tag validation helper
   - Add `scripts/validate/verify-tags.mjs` ensuring each `project.json` lists the required `tags`. Run inside CI before build.

> Idiosyncrasy: Keep everything shared under `libs/`. Parallel `frontend/` or `backend/` folders create tooling drift and break module-boundary assumptions.

---

## 4. TypeScript Baseline, ESM, and Project References

1. Root `tsconfig.base.json`
   ```json
   {
     "compilerOptions": {
       "target": "ES2024",
       "lib": ["ES2024"],
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "allowSyntheticDefaultImports": true,
       "esModuleInterop": true,
       "strict": true,
       "skipLibCheck": true,
       "resolveJsonModule": true,
       "forceConsistentCasingInFileNames": true,
       "verbatimModuleSyntax": true,
       "moduleDetection": "force",
       "exactOptionalPropertyTypes": true,
       "baseUrl": ".",
       "declaration": true,
       "declarationMap": true,
       "composite": true,
       "paths": {
         "@platform/*": ["libs/platform/*/src"],
         "@shared/*": ["libs/shared/*/src"],
         "@contexts/*": ["libs/contexts/*/src"],
         "@integrapcs/shared-types": ["packages/shared-types/src/index.ts"],
         "@integrapcs/design-tokens": ["packages/design-tokens/src/index.ts"]
       }
     }
   }
   ```
2. Per-library configs
   - Example (`libs/platform/db/tsconfig.json`):
     ```json
     {
       "extends": "../../../tsconfig.base.json",
       "compilerOptions": {
         "outDir": "../../../dist/libs/platform/db",
         "rootDir": "src",
         "types": ["node"]
       },
       "include": ["src/**/*.ts"],
       "references": [
         { "path": "../../shared/common/tsconfig.json" },
         { "path": "../../shared/kernel/tsconfig.json" }
       ]
     }
     ```
3. Application configs (e.g., `apps/api/tsconfig.json`) should reference dependent libs
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "../../dist/apps/api",
       "rootDir": "src",
       "types": ["node"]
     },
     "include": ["src/**/*.ts"],
     "references": [
       { "path": "../../libs/contexts/work-package/tsconfig.json" },
       { "path": "../../libs/platform/graphql/tsconfig.json" },
       { "path": "../../libs/platform/db/tsconfig.json" },
       { "path": "../../libs/shared/common/tsconfig.json" }
     ]
   }
   ```
4. Web app TypeScript config (`apps/web/tsconfig.json`)
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "../../dist/apps/web",
       "rootDir": "src",
       "lib": ["ES2024", "DOM", "DOM.Iterable"],
       "jsx": "react-jsx",
       "types": ["vite/client"]
     },
     "include": ["src/**/*.ts", "src/**/*.tsx"]
   }
   ```
5. Post-build alias rewriting
   - Replace runtime symlink hacks with `tsc-alias`. Each `build` target should run `tsc -b` followed by `tsc-alias -p <tsconfig>`.
6. Package manifests & workspace protocol
   - For every buildable library/package, add a local `package.json`:
     ```json
     {
       "name": "@platform/db",
       "version": "0.0.0",
       "type": "module",
       "exports": {
         ".": {
           "import": "./dist/index.js",
           "types": "./dist/index.d.ts"
         },
         "./package.json": "./package.json"
       },
       "types": "./dist/index.d.ts",
       "publishConfig": { "access": "restricted" }
     }
     ```
   - Reference internal packages via `"workspace:*"` ranges in `dependencies`/`devDependencies` to prevent accidental registry fetches.
   - Ensure each subproject inherits path aliases from `tsconfig.base.json` (i.e., do not override `paths` locally) so `tsc-alias` can rewrite imports correctly.
   - Enforce this via CI by grepping for `"paths"` in project-level `tsconfig*.json` files and failing builds when overrides are detected.
7. Shared Vitest workspace
   - Create `vitest.workspace.ts` to unify NodeNext settings:
     ```ts
     import { defineWorkspace } from 'vitest/config';

     export default defineWorkspace([
       {
         test: {
           environment: 'node',
           coverage: { provider: 'v8', reporter: ['text', 'lcov'], lines: 80 },
           testTimeout: 10000,
           deps: { inline: ['ts-node'] }
         }
       }
     ]);
     ```
   - In projects, either omit a local Vitest config or use `defineConfig({ test: { ... } })`; do not call `defineWorkspace` outside the root `vitest.workspace.ts`.

---

## 5. Coding Standards & Linting

1. EditorConfig (`.editorconfig`)
   ```
   root = true

   [*]
   charset = utf-8
   indent_style = space
   indent_size = 2
   end_of_line = lf
   insert_final_newline = true
   trim_trailing_whitespace = true
   ```
2. Prettier (`.prettierrc.json`)
   ```json
   {
     "semi": true,
     "singleQuote": true,
     "tabWidth": 2,
     "trailingComma": "none",
     "printWidth": 100,
     "arrowParens": "avoid",
     "endOfLine": "lf",
     "plugins": ["prettier-plugin-tailwindcss"]
   }
   ```
3. Stylelint (`stylelint.config.cjs`)
   ```js
   module.exports = {
     extends: ['stylelint-config-recommended', 'stylelint-config-tailwindcss'],
     rules: {
       'color-function-notation': null,
       'declaration-no-important': true
     },
     ignoreFiles: ['**/dist/**', '**/node_modules/**', '**/.storybook/**']
   };
   ```
4. ESLint flat config (`eslint.config.js`)
   ```js
   import nxPlugin from '@nx/eslint-plugin';
   import js from '@eslint/js';
   import tseslint from '@typescript-eslint/eslint-plugin';
   import tsParser from '@typescript-eslint/parser';
   import react from 'eslint-plugin-react';
   import jsxA11y from 'eslint-plugin-jsx-a11y';
   import importPlugin from 'eslint-plugin-import';

   export default [
     {
       ignores: [
         'dist/**',
         'coverage/**',
         'node_modules/**',
         '.nx/**',
         '**/generated/**',
         '**/storybook-static/**'
       ]
     },
     js.configs.recommended,
     ...tseslint.configs.recommendedTypeChecked,
     react.configs.flat.recommended,
     jsxA11y.configs.recommended,
     {
       files: ['**/*.{ts,tsx,js,jsx}'],
       languageOptions: {
         parser: tsParser,
         parserOptions: {
           projectService: true,
           tsconfigRootDir: process.cwd()
         }
       },
       settings: {
         'import/resolver': {
           typescript: {
             projectService: true,
             alwaysTryTypes: true
           }
         }
       },
       plugins: {
         '@nx': nxPlugin,
         '@typescript-eslint': tseslint,
         'react': react,
         'import': importPlugin
       },
       rules: {
         '@nx/enforce-module-boundaries': [
           'error',
           {
             enforceBuildableLibDependency: true,
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
         ],
         '@typescript-eslint/no-floating-promises': 'error',
         '@typescript-eslint/no-misused-promises': 'error',
         '@typescript-eslint/explicit-function-return-type': 'warn',
         'react/forbid-dom-props': ['error', { forbid: ['style'] }],
         'import/no-unresolved': ['error', { commonjs: false, caseSensitive: true }],
         'import/order': [
           'error',
           {
             'groups': [
               'builtin',
               'external',
               'internal',
               ['parent', 'sibling', 'index'],
               'object',
               'type'
             ],
             'newlines-between': 'always',
             'alphabetize': { order: 'asc', caseInsensitive: true }
           }
         ]
       }
     },
     {
       files: ['**/*.{tsx,jsx}'],
       settings: { react: { version: 'detect' } }
     }
   ];
   ```
5. `.gitattributes` and `.gitignore`
   ```
   * text=auto eol=lf
   dist/** -diff
   ```

   `.gitignore`
   ```
   dist/
   .nx/cache/
   coverage/
   **/generated/
   .env*
   !.env.example
   playwright-report/
   test-results/
   ```

   `.prettierignore`
   ```
   dist/
   coverage/
   **/generated/
   .nx/
   ```

---

## 6. Domain-Driven Context Scaffold

1. Generate buildable Nx library
   ```bash
   pnpm nx g @nx/js:library contexts-work-package \
     --directory=libs/contexts/work-package \
     --importPath=@contexts/work-package \
     --buildable \
     --unitTestRunner=vitest
   ```
2. Structure
   ```
   libs/contexts/work-package/
     ├─ domain/              # Aggregates, Entities, Value Objects, Commands, Events
     ├─ application/         # CommandHandlers, QueryHandlers, Projection pipelines
     ├─ infrastructure/      # Event store adapters, projections, outbox, messaging
     └─ interfaces/graphql/  # SDL, resolvers, generated/ artifacts
   ```
3. Project configuration
   - Tags: `["scope:context:work-package", "layer:interfaces", "buildable"]`.
   - `build`: `tsc -b libs/contexts/work-package/tsconfig.json && tsc-alias -p libs/contexts/work-package/tsconfig.json`.
   - `project.json` `outputs`: `["{workspaceRoot}/dist/libs/contexts/work-package"]` to align with Nx cache.
   - `test`: Vitest with event replay fixtures.
   - `lint`: `nx lint` target referencing ESLint config.
4. Generated code policy
   - `interfaces/graphql/generated/` is ignored in git (`.gitignore`).
   - CI job runs `graphql-codegen` and fails if `git status --porcelain` is non-empty.
5. DDD boundaries
   - Domain layer imports only `@shared/kernel` and `@shared/common`.
   - Application layer depends on domain + `@shared/patterns` ports.
   - Infrastructure layer depends on application/domain/shared/platform.
   - Interfaces layer depends on application/shared/platform only.

---

## 7. Platform Services

Generate each with `@nx/js:library` (buildable) under `libs/platform/<service>` and tag with `["scope:platform", "type:lib", "buildable"]`. Ensure each `project.json` declares `outputs` such as `["{workspaceRoot}/dist/libs/platform/db"]` so Nx caching remains deterministic across all platform libs.

- `platform/db`: Neo4j driver lifecycle, health checks, connection pooling.
- `platform/messaging`: RabbitMQ connection/topology, channel pooling.
- `platform/graphql`: Apollo composition utilities, GraphQL context helpers, PubSub bridging.
- `platform/auth`: JWT verification, RBAC policy interface.
- `platform/config`: Zod-backed configuration schema, `dotenv-safe` integration.
- `platform/observability`: OpenTelemetry initialisation for traces/metrics/logging.
- `platform/security`: Security middleware (headers, rate limiting, CSRF for GraphQL).

Each `build` target uses `tsc -b` + `tsc-alias`. Add integration tests for driver bootstrapping wherever feasible.

---

## 8. Shared Kernel & Patterns

1. Kernel (`libs/shared/kernel`)
   - Expose `Entity`, `AggregateRoot`, `ValueObject`, domain errors.
   - Tags: `["scope:shared", "type:lib", "layer:domain", "buildable"]`.
   - `project.json` `outputs`: `["{workspaceRoot}/dist/libs/shared/kernel"]`.
2. Patterns (`libs/shared/patterns`)
   - Define ports like `EventStore`, `OutboxRepository`, `ProjectionStore`.
   - `project.json` `outputs`: `["{workspaceRoot}/dist/libs/shared/patterns"]`.
3. Common (`libs/shared/common`)
   - Pure helpers (UUID, ISO time, error factories).
   - `project.json` `outputs`: `["{workspaceRoot}/dist/libs/shared/common"]`.
4. Build targets: `tsc -b` + `tsc-alias`, ensuring they’re buildable libs so boundary enforcement remains accurate.

---

## 9. Publishable Packages

### `packages/design-tokens`
- Provide Tailwind v4 tokens (`src/tokens.css`).
- `build` script copies CSS into `dist/packages/design-tokens`.
- Document usage: `@import "@integrapcs/design-tokens/tokens.css";`.
- `project.json` `outputs`: `["{workspaceRoot}/dist/packages/design-tokens"]`.
- **Important**: Add `tailwindcss` as a peer dependency in `package.json`:
  ```json
  {
    "name": "@integrapcs/design-tokens",
    "peerDependencies": {
      "tailwindcss": "^4.0.0"
    }
  }
  ```
  This ensures the `@import "tailwindcss"` directive in tokens.css resolves correctly when consumed by other packages.

### `packages/shared-types`
- Export shared GraphQL DTOs and event payload schemas.
- `build`: `tsc -p packages/shared-types/tsconfig.json && tsc-alias -p packages/shared-types/tsconfig.json`.
- Add contract tests to ensure DTOs stay backward compatible (snapshot or JSON schema).
- `project.json` `outputs`: `["{workspaceRoot}/dist/packages/shared-types"]`.

---

## 10. GraphQL Code Generation

1. Configuration (`codegen.ts`)
   ```ts
   import { CodegenConfig } from '@graphql-codegen/cli';

   const config: CodegenConfig = {
     schema: 'apps/api/src/graphql/schema.graphql',
     documents: ['apps/web/src/**/*.graphql', 'libs/contexts/**/*.graphql'].sort(),
     generates: {
       'libs/contexts/work-package/interfaces/graphql/generated/': {
         preset: 'client'
       },
       'packages/shared-types/src/generated/graphql.ts': {
         plugins: ['typescript', 'typescript-operations']
       }
     },
     hooks: {
       afterAllFileWrite: ['prettier --write']
     }
   };

   export default config;
   ```
2. Scripts
   - Root `package.json`: `"graphql:codegen": "graphql-codegen --config codegen.ts"`.
   - Install `@graphql-codegen/cli`, `@graphql-codegen/client-preset`, `@graphql-codegen/typescript`, `@graphql-codegen/typescript-operations` as dev dependencies.
   - Add CI step to run the script and fail if `git status --porcelain` reports generated diffs.
   - Provide local helper: `pnpm graphql:codegen --watch` for DX.

---

## 11. Applications

### API Gateway (`apps/api`)
```bash
pnpm nx g @nx/node:application api --directory=apps/api --bundler=none --unitTestRunner=vitest
```
- Tags: `["scope:app", "type:api"]`.
- `build`: `tsc -b apps/api/tsconfig.json && tsc-alias -p apps/api/tsconfig.json`.
- `project.json` `outputs`: `["{workspaceRoot}/dist/apps/api"]`.
- `serve`: `node --enable-source-maps dist/apps/api/main.js`.
- GraphQL integration tests using Vitest + `supertest`.
- Import GraphQL modules from contexts, inject platform services.

### Jobs (`apps/jobs/outbox-publisher`, `apps/jobs/projection-consumer`)
- Generate with `@nx/node:application`.
- `build`: `tsc -p apps/jobs/<job>/tsconfig.json --outDir dist/apps/jobs/<job> && tsc-alias -p apps/jobs/<job>/tsconfig.json`.
- `project.json` `outputs`: e.g., `["{workspaceRoot}/dist/apps/jobs/outbox-publisher"]`.
- Provide idempotency tests to replay events and confirm projections/outbox behaviour.

### Web (`apps/web`)
```bash
pnpm nx g @nx/react:app web \
  --directory=apps/web \
  --bundler=vite \
  --unitTestRunner=vitest \
  --e2eTestRunner=playwright \
  --style=css
```

- **Frontend dependencies** (add to `apps/web/package.json` or standalone `frontend/package.json`):
  ```bash
  pnpm add \
    react@^19.2.0 react-dom@^19.2.0 \
    @apollo/client@^4.1.0 graphql@16.11.0 graphql-ws@^5.16.0 \
    zustand@^5.0.10 use-sync-external-store@^1.4.0 \
    react-router-dom@^7.12.0 react-hook-form@^7.71.0 @hookform/resolvers@^5.1.1 \
    zod@^3.25.56 \
    @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select \
    tailwind-merge@^3.3.0 class-variance-authority@^0.7.1 clsx@^2.1.1 \
    lucide-react@^0.513.0
  ```

- **Apollo Client 4 setup**:
  ```ts
  // main.tsx - React components are in @apollo/client/react
  import { ApolloProvider } from '@apollo/client/react';
  import { apolloClient } from './lib/apollo';

  // lib/apollo.ts - Core + error handling
  import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
  import { ErrorLink } from '@apollo/client/link/error';
  import { CombinedGraphQLErrors } from '@apollo/client/errors';

  const errorLink = new ErrorLink(({ error, operation }) => {
    if (CombinedGraphQLErrors.is(error)) {
      error.errors.forEach(({ message, path }) =>
        console.error(`[GraphQL error]: ${message}, Path: ${path}`)
      );
    } else {
      console.error(`[Network error]: ${error.message}`);
    }
  });

  export const apolloClient = new ApolloClient({
    link: from([errorLink, httpLink]),
    cache: new InMemoryCache({ typePolicies }),
    devtools: { enabled: import.meta.env.DEV }
  });
  ```

- **Zustand 5 setup**:
  ```ts
  import { create } from 'zustand';
  import { useShallow } from 'zustand/shallow';

  // Define store
  const useAppStore = create<AppState>((set) => ({
    count: 0,
    increment: () => set((s) => ({ count: s.count + 1 }))
  }));

  // Select multiple values with shallow comparison
  const { count, text } = useAppStore(useShallow(s => ({ count: s.count, text: s.text })));
  ```
  Note: `use-sync-external-store` is required as a peer dependency.

- **Internal package references** (use `workspace:*` protocol):
  ```json
  {
    "dependencies": {
      "@integrapcs/design-tokens": "workspace:*",
      "@integrapcs/shared-types": "workspace:*"
    }
  }
  ```

- Tailwind v4 setup (install manually as Nx does not scaffold v4 yet):
  ```bash
  pnpm add -D tailwindcss@^4.1.0 @tailwindcss/postcss@^4.0.0 postcss autoprefixer
  ```
- Configure `postcss.config.cjs` with Tailwind v4 and import tokens in `apps/web/src/styles/tokens.css`.
- Tags: `["scope:app", "type:web", "buildable"]`.
- `project.json` `outputs`: `["{workspaceRoot}/dist/apps/web"]`.
- TypeScript config: ensure DOM libs + JSX + Vite types as noted in section 4.4.
- Layout:
  ```
  apps/web/
    src/app/
    src/features/work-package/{components,graphql,hooks,pages,types}
    src/lib/
    src/styles/tokens.css  # imports @integrapcs/design-tokens/tokens.css
    tests/setup.ts
    e2e/*.spec.ts
    .storybook/
  ```
- Tailwind v4 with PostCSS, no arbitrary values or inline styles.
- Playwright baseURL: set in e2e config to avoid hard-coded ports:
  ```ts
  import { defineConfig } from '@playwright/test';

  export default defineConfig({
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
      baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'
    }
  });
  ```
- Add Storybook Accessibility & Interactions addons and Chromatic script:
  ```bash
  pnpm add -D storybook@^10.1.11 @storybook/react-vite@^10.1.11 @storybook/addon-docs@^10.1.11 chromatic@^13.3.0
  ```
- Vite configuration: Use Vite 6.x (Vite 7 has ecosystem compatibility issues with `@tailwindcss/vite` and Vitest peer deps as of Jan 2026):
  ```bash
  pnpm add -D vite@^6.4.1 @vitejs/plugin-react@^4.5.0
  ```
- Verify `stylelint-config-tailwindcss` compatibility with Tailwind v4; capture upgrade plans in an ADR if pinning versions.

---

## 12. Scripts & Utilities

1. Root `package.json` scripts
   ```json
   {
     "scripts": {
       "dev": "nx run-many -t serve --parallel",
       "build": "nx run-many -t build",
       "test": "nx run-many -t test --parallel",
       "lint": "nx run-many -t lint",
       "lint:fix": "nx run-many -t lint -- --fix",
       "typecheck": "nx run-many -t typecheck",
       "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,css}\" --ignore-path .gitignore",
       "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,css}\" --ignore-path .gitignore",
       "graph": "nx graph",
       "clean": "nx run-many -t clean --if-present && rm -rf node_modules",
       "check:tailwind": "node scripts/check-tailwind-arbitrary.mjs",
       "lint:staged": "lint-staged",
       "generate:demos": "node scripts/generate-token-demos.mjs",
       "deadcode": "ts-prune -p tsconfig.base.json"
     }
   }
   ```
2. Tailwind guard (`scripts/check-tailwind-arbitrary.mjs`)
   - Scan `apps/web/src/**/*.{ts,tsx,js,jsx}`.
   - Flag bracket utilities, inline styles, and `!important`.
   - Accept `--staged` mode to limit scope during pre-commit.
3. Require guard (`scripts/validate/check-staged-ts-require.mjs`)
   - Inspect staged TS files and block `require()` usage.
4. Tag enforcement (`scripts/validate/verify-tags.mjs`)
   - Ensure every `project.json` includes the required Nx tags.
5. Typecheck target in every `project.json`
   - Define a `typecheck` target so hooks and CI can run it consistently:
     ```json
     {
       "targets": {
         "typecheck": {
           "command": "tsc --noEmit -p <tsconfig>"
         }
       }
     }
     ```

---

## 13. Husky & lint-staged

1. Init Husky
   ```bash
   pnpm dlx husky init
   git config core.hooksPath .husky
   ```
2. `lint-staged` configuration (`package.json`)
   ```json
   "lint-staged": {
     "*.{ts,tsx,js,jsx}": [
       "nx format:write --files",
       "nx lint --files",
       "nx run-many --target typecheck --files",
       "node scripts/check-tailwind-arbitrary.mjs --staged",
       "node scripts/validate/check-staged-ts-require.mjs --staged"
     ],
     "*.css": [
       "stylelint --fix"
     ],
     "*.{json,md}": "prettier --write"
   }
   ```
3. `.husky/pre-commit`
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMRT)
   if [ -z "$STAGED_FILES" ]; then
     exit 0
   fi

   echo "🔍 Running pre-commit checks..."
   pnpm lint:staged

   # Block .only in tests
   if git diff --cached --name-only --diff-filter=ACMRT | grep -E '\.(test|spec)\.(ts|tsx|js|jsx)$' >/dev/null; then
     if git diff --cached -U0 | grep -E '\b(describe|it|test|suite)\.only\('; then
       echo "❌ Remove .only() from tests before committing."
       exit 1
     fi
   fi

   echo "✅ All pre-commit checks passed."
   ```
4. Commit-message & pre-push hooks
   - `pnpm add -D @commitlint/cli @commitlint/config-conventional`
   - `.commitlintrc.cjs`:
     ```js
     module.exports = { extends: ['@commitlint/config-conventional'] };
     ```
   - `.husky/commit-msg`:
     ```bash
     #!/usr/bin/env bash
     set -euo pipefail
     pnpm exec commitlint --edit "$1"
     ```
   - `.husky/pre-push`:
     ```bash
     #!/usr/bin/env bash
     set -euo pipefail
     git fetch origin main --depth=1 || true
     pnpm nx affected -t typecheck,test --base=origin/main --head=HEAD --parallel
     ```
5. Avoid `nx affected` in pre-commit hooks; use `--files` variants to keep execution scoped and deterministic.

---

## 14. Secrets & Configuration Management

1. `.env.example` at repo root covering all required vars (`NEO4J_AUTH`, `RABBITMQ_URL`, `REDIS_URL`, `JWT_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT`, etc.).
2. `dotenv-safe` integration
   - Load inside `platform/config` and validate via Zod schema.
   - Fail fast if variables are missing or invalid.
3. Secret scanning
   - Add `gitleaks.toml`.
   - Run `pnpm dlx gitleaks detect --config gitleaks.toml` in CI.
   - Provide `.env.local` consumed by compose; never hardcode credentials in YAML.

---

## 15. Dev Environment Orchestration

> **OrbStack vs Docker Desktop**: If using OrbStack on macOS, all `docker` and `docker compose` commands work identically. OrbStack provides faster container startup, lower memory usage, and seamless integration. Ensure OrbStack is running (`orbctl start`) before executing compose commands.

1. `local/docker-compose.yml`
   ```yaml
   services:
     neo4j:
       image: neo4j:5.25.1-community
       ports:
         - "7474:7474"
         - "7687:7687"
       env_file:
         - .env.local
       environment:
         NEO4J_PLUGINS: '["apoc"]'
         # Use a single auth variable (unified): NEO4J_AUTH="neo4j/<password>"
         NEO4J_AUTH: ${NEO4J_AUTH}
       healthcheck:
         test:
           - CMD-SHELL
           - |
             set -eu
             [ -n "$NEO4J_AUTH" ] || exit 1
             USER="${NEO4J_AUTH%/*}"; PASS="${NEO4J_AUTH#*/}";
             echo 'RETURN 1' | cypher-shell -a bolt://localhost:7687 -u "$USER" -p "$PASS" || exit 1
         interval: 15s
         timeout: 10s
         retries: 5
       volumes:
         - neo4j_data:/data
         - neo4j_logs:/logs

     redis:
       image: redis:7-alpine
       command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
       ports:
         - "6379:6379"
       env_file:
         - .env.local
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]
         interval: 10s
         timeout: 5s
         retries: 5

     rabbitmq:
       image: rabbitmq:3.13-management-alpine
       ports:
         - "5672:5672"
         - "15672:15672"
       env_file:
         - .env.local
       healthcheck:
         test: ["CMD", "rabbitmq-diagnostics", "ping"]
         interval: 15s
         timeout: 10s
         retries: 5
       depends_on:
         neo4j:
           condition: service_healthy

   volumes:
     neo4j_data:
     neo4j_logs:

   networks:
     default:
       name: integrapcs-dev
       driver: bridge
   ```
   - Ensure `cypher-shell` is available inside the Neo4j container; the official 5.x community image includes it by default.
   - Provide `NEO4J_AUTH="neo4j/<password>"` in `.env.local`. Healthcheck parses it into user/password; no conflicting vars.

2. Dev start script (`dev-start.sh`)
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   pnpm nx run-many -t serve --projects=api,web --parallel --watch
   ```
   (Run `corepack enable && corepack prepare pnpm@9.0.0 --activate` once per machine as part of onboarding rather than inside the script.)
3. Local seeds
   - `local/seeds/` with idempotent Neo4j seed scripts (Cypher) and RabbitMQ topology scripts.
4. Secrets hygiene
   - For production-like environments, favour Docker secrets or Docker Compose profiles that mount credentials instead of plain env files.

---

## 16. Testing & Quality Gates

1. API tests
   - Add `apps/api/tests/graphql.spec.ts` using Vitest + `supertest` to validate resolvers.
   - Cover authN/authZ guards and ensure schema snapshots are stored.
2. Event idempotency tests
   - Replay event streams against projections to confirm deterministic outcomes.
3. Contract checks
   - Use `@graphql-codegen` to generate typings.
   - Snapshot generated schema + DTOs in CI to detect breaking changes.
4. Coverage
   - Enable `--coverage` in Vitest/Jest configs with repo-level threshold ≥ 80%.
   - Fail CI if coverage dips below thresholds.
5. Tailwind scanning
   - Maintain `pnpm run check:tailwind` as a CI gate.
6. Dead code detection
   - Add `ts-prune` (`pnpm add -D ts-prune`) and run `pnpm deadcode` in CI to catch orphaned exports.

---

## 17. Observability & Security

1. OpenTelemetry
   - Initialize tracing in `platform/observability`.
   - Export to OTLP HTTP in prod; use console exporter locally.
   - Propagate context through jobs and GraphQL resolvers.
2. Security
   - Define `SECURITY.md` with disclosure process.
   - Implement GraphQL CSRF strategy (double-submit cookie or operation allowlist).
   - Configure CORS with explicit origins and fail closed if env unset.
   - Add rate limiting via `platform/security`.
   - Provide unit tests for RBAC policies in `platform/auth`.
3. Dependency scanning
   - Run `pnpm dlx osv-scanner --recursive --lockfile=pnpm-lock.yaml --severity-level=HIGH --skip-git --format sarif --output osv-results.sarif` and upload the SARIF for GitHub code scanning.
   - Schedule a weekly workflow to catch drift.

---

## 18. CI/CD Pipeline

1. GitHub Actions (`.github/workflows/ci.yml`)
   - Steps:
     - `uses: actions/checkout@v4`
     - `uses: actions/setup-node@v4` with `node-version: 22.22.0`, `cache: 'pnpm'`, `cache-dependency-path: pnpm-lock.yaml`.
     - `run: corepack enable && corepack prepare pnpm@9.0.0 --activate`.
     - `run: pnpm fetch`.
     - `run: pnpm install --frozen-lockfile`.
     - Cache `~/.pnpm-store` for faster installs.
     - `run: pnpm lint` (lint + typecheck combined if desired).
     - `run: pnpm test`.
     - Install Playwright browsers and deps before e2e:
        ```yaml
        - run: pnpm dlx playwright install --with-deps
        ```
        Optional cache:
        ```yaml
        - name: Cache Playwright
          uses: actions/cache@v4
          with:
            path: ~/.cache/ms-playwright
            key: ${{ runner.os }}-playwright-${{ hashFiles('pnpm-lock.yaml') }}
        ```
     - `run: pnpm nx e2e web`.
     - `run: pnpm run check:tailwind`.
     - `run: pnpm nx run-many -t build`.
   - On pull requests, prefer:
     ```yaml
     - run: pnpm nx affected -t lint,typecheck,test,build --parallel --base=$NX_BASE --head=$NX_HEAD
     ```
     and set `NX_BASE`/`NX_HEAD` from `github.event.pull_request`.
   - Cache `.nx/cache` via `actions/cache` with a key such as `${{ runner.os }}-nx-${{ hashFiles('pnpm-lock.yaml') }}` to ensure invalidation on lockfile changes.
   - Add workspace protocol enforcement guard:
     ```bash
     if grep -RE '"@(?:contexts|platform|shared|integrapcs)/' -n -- */package.json \
       | grep -v 'workspace:\*'; then
       echo 'Use workspace:* for internal deps.'; exit 1; fi
     ```
   - Split jobs (lint/typecheck, unit tests, e2e, build) for parallelisation with artifacts (Playwright traces, coverage).
   - Set workflow metadata:
     ```yaml
     concurrency: ci-${{ github.ref }}
     permissions:
       contents: read
     ```
2. Chromatic workflow
   - Separate job running:
     ```yaml
     - run: pnpm nx run web:storybook:build
     - run: pnpm nx run web:chromatic
     # Upload the static Storybook on failure to aid debugging
     - name: Upload Storybook static (on failure)
       if: failure()
       uses: actions/upload-artifact@v4
       with:
         name: storybook-static
         path: dist/apps/web/storybook
         if-no-files-found: ignore
     ```
   - Use a dedicated Chromatic token with minimal GitHub permissions.
3. Automation
   - Add `renovate.json` to manage updates (include lockfile maintenance and Nx migrate plans).
   - Include `pnpm dedupe --check` and `pnpm deadcode` stages in CI.

---

## 19. Documentation & Governance

1. Docs structure
   - `docs/UI system/UI_Design_System_Instructions.md` & `UI_Design_System_Enforcement.md`.
   - `docs/GRAPHQL_LAYER.md`, `NEO4J_INTEGRATION.md`, `OBSERVABILITY.md`, `SECURITY.md`.
   - `docs/ADR/template.md` and require ADRs for architectural changes.
2. Project README essentials
   - Quickstart (pnpm install, docker-compose up, nx serve).
   - Repo layout, tooling primer, development workflow, testing strategy, CI gates.
3. Context docs
   - `libs/contexts/work-package/README.md` covering boundaries, ports, test instructions.
4. Versioning & commits
   - Adopt Conventional Commits + Changesets for internal package release notes (even private).
   - Add commitlint (`@commitlint/cli`, `@commitlint/config-conventional`) with `.commitlintrc.cjs` and a `husky` `commit-msg` hook.
   - Install `@changesets/cli` and run `pnpm changeset init` to manage version bumps across packages.
   - Scripts:
     ```json
     {
       "version-packages": "changeset version",
       "release": "changeset publish"
     }
     ```
5. Governance artifacts
   - Add `LICENSE` (default MIT unless org policy differs).
   - Maintain `SECURITY.md` with disclosure instructions.

---

## 20. Verification Checklist

Run locally before first PR:

1. `pnpm install --frozen-lockfile`
2. `pnpm run format:check`
3. `pnpm nx run-many -t lint`
4. `pnpm nx run-many -t typecheck`
5. `pnpm nx run-many -t build`
6. `pnpm nx test web --coverage`
7. `pnpm nx e2e web`
8. `pnpm run check:tailwind`
9. `pnpm deadcode`
10. `pnpm run lint:staged -- --allow-empty`
11. `pnpm nx graph`

All commands must pass locally before enabling CI to avoid first-run failures.

---

## 21. Next Steps After Bootstrap

1. Flesh out aggregates, commands, and event payloads for the initial bounded context.
2. Implement GraphQL schema, resolvers, and connect to application handlers.
3. Seed idempotent data via `local/seeds` and document reset procedures.
4. Build out jobs (outbox → RabbitMQ, projection consumers) and ensure replay tests pass.
5. Standardise observability (OpenTelemetry exporters, structured logging, metrics).
6. Enforce coverage thresholds and add contract/idempotency tests to CI.
7. Configure Renovate, gitleaks, and audit jobs for continuous maintenance.
8. Keep documentation aligned with any deviations discovered during development.

---

Strong. Final tightenings (applied):

- Compose YAML indentation fixed; auth unified on NEO4J_AUTH with healthcheck parsing it.
- Playwright install added before e2e in CI; optional cache for ms-playwright documented.
- Web TS config: DOM libs + JSX + Vite types included for apps/web.
- ESLint: React + jsx-a11y flat configs enabled; added `eslint-plugin-jsx-a11y`. Optional import hygiene added with `eslint-plugin-import` + TS resolver and rules.
- pnpm: added `shared-workspace-lockfile=true` to `.npmrc`.
- Nx cache determinism: ensure every `build` target has `outputs` pointing to its dist path (explicitly called out in contexts, platform, shared, packages, and apps sections).
- Git hooks: `commit-msg` now has `set -euo pipefail`; stronger `.only` guard in pre-commit.
- Storybook CI: upload static build artifact on failure for easier debugging.

Following this playbook yields an opinionated, ESM-native Nx monorepo that matches the integraPCS architecture and mitigates the foot-guns uncovered during repository analysis. If workflow needs diverge, update both the tooling and this guide—do not rely on undocumented exceptions.
