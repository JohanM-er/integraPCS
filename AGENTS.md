# Repository Guidelines

## Project Structure & Module Organization
- npm workspaces manage `apps/`, `contexts/`, `platform/`, `shared/`, and `packages/`.
- `apps/api/` hosts the GraphQL API gateway; compiled output under `dist/apps/api/`.
- `apps/web/src/` contains the Vite + React app, with Vitest suites in `apps/web/tests/`, Storybook stories in `apps/web/src/**/*.stories.tsx`, and Playwright specs in `apps/web/e2e/`.
- `packages/design-tokens/` exposes Tailwind v4 theme tokens consumed by UI workspaces.
- Shared contracts stay in `packages/shared-types/src/`; Nx builds this lib as needed.

## Build, Test, and Development Commands
- Run `pnpm install` once at the repo root to hydrate every workspace.
- Start dev:
  - API: `pnpm nx serve api`
  - Web: `pnpm nx serve web`
  - All: `pnpm nx run-many -t serve --projects=api,web --parallel` (see dev-start.sh)
- Build:
  - All: `pnpm nx run-many -t build`
  - Focused: `pnpm nx build apps/web` or `pnpm nx build packages-shared-types`
- Quality gates at the root:
  - Lint: `pnpm nx affected -t lint`
  - Typecheck: `pnpm nx affected -t typecheck`
  - Format check: `pnpm run format:check`
  - Tailwind arbitrary scan: `pnpm run check:tailwind` (scans apps/web/src)
- Testing:
  - Unit (web): `pnpm nx test web`
  - E2E (web): `pnpm nx e2e web`
  - Chromatic: `pnpm nx run web:storybook` (dev) or `pnpm nx run web:storybook:build`

## Coding Style & Naming Conventions
- Prettier owns formatting (`tabWidth: 2`, single quotes, no trailing commas). Tailwind class ordering is handled by `prettier-plugin-tailwindcss`; run `pnpm run format` before pushing.
- ESLint focuses on TypeScript/React/a11y rules and general code quality; DDD layer boundaries are enforced via the root `@nx/enforce-module-boundaries` rule.
- Tailwind guardrails: Avoid arbitrary values like `p-[13px]` and `text-[#333]`. These are blocked by a pre-commit check and CI scanning `apps/web/src`.
- Stylelint lints CSS (root config extends `stylelint-config-tailwindcss`), but it does not validate Tailwind utility strings in JSX.
- Naming rules: PascalCase for types/interfaces, camelCase for variables and parameters, UPPER_CASE for enum members.

## Testing Guidelines
- API/Context tests will be introduced per Nx project targets; for now:
  - Web unit: `pnpm nx test web` (Vitest)
  - Web E2E: `pnpm nx e2e web` (Playwright)
  - Chromatic visual baselines via `apps/web/.storybook`
- Co-locate specs as `*.test.ts` or `*.spec.ts`; Husky blocks commits containing `.only` or missing `describe`/`it`.

## Commit & Pull Request Guidelines
- Follow the existing short, imperative commit subjects and keep scope tight.
- Before opening a PR, run lint, typecheck, and the affected test targets; call out what you executed in the description.
- Link tickets, attach screenshots (or Chromatic diffs) for UI updates, and mention schema or contract changes explicitly.
- Husky pre-commit runs staged type checks, import validation, and console/log scans—treat warnings as merge blockers.

## Environment & Integration Tips
- Start dependencies with `docker-compose up -d`; credentials are defined beside each service in the compose file.
- Load secrets through ignored `.env` files consumed by backend config loaders and Vite `import.meta.env`.
- Use Node.js 20+ to match workspace `engines` and avoid type incompatibilities during CI.

## Visual Guardrails
- Import `@integrapcs/design-tokens/tokens.css` (or `apps/web/src/styles/tokens.css`) before authoring UI. Allowed utilities: `bg-brand-500`, `text-neutral-900`, spacing `{1,2,3,4,5,6}`, typography scale, `rounded-2`, `shadow-1`, table surfaces, and `border-table`.
- Doc map:
  - `docs/UI system/UI_Design_System_Instructions.md` – token usage, spacing, tables, overlays, implementation checklist.
  - `docs/UI system/UI_Design_System_Enforcement.md` – describes pre-commit, CI, and CVA guardrails that enforce the system.
- Do not use inline styles or Tailwind arbitrary values (e.g., `p-[13px]`, `text-[#333]`). The pre-commit hook and CI block these in `apps/web/src`.
- Prefer composing existing components in `apps/web/src/features` rather than bespoke markup.
- Uphold accessibility in generated output (semantic structure, labelled controls, focus states, descriptive alt text).
- Add or update a Storybook story for every new visual component to keep Chromatic baselines current.
