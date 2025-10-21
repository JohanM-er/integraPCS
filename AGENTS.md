# Repository Guidelines

## Project Structure & Module Organization
- npm workspaces manage `backend/`, `frontend/`, `packages/design-tokens/`, and `packages/shared-types/`.
- `backend/src/` holds Apollo GraphQL vertical slices; compiled code lives in `backend/dist/`.
- `frontend/src/` contains the Vite + React app, with Vitest suites in `frontend/tests/`, Storybook stories in `frontend/src/**/*.stories.tsx`, and Playwright specs in `frontend/e2e/`.
- `packages/design-tokens/` exposes Tailwind v4 theme tokens consumed by every UI workspace.
- Shared contracts stay in `packages/shared-types/src/`; rebuild that package when GraphQL payloads change.

## Build, Test, and Development Commands
- Run `npm install` once at the repo root to hydrate every workspace (design tokens, backend, frontend, shared types).
- `npm run dev` (via `dev-start.sh`) builds shared types, then starts the backend on :3000 and frontend on :5173.
- `npm run build` executes all workspace builds; use `npm run build -w backend|frontend|packages/shared-types` for focused checks. Tokens are plain CSS, no build step required.
- Daily loops: `npm run dev -w backend`, `npm run dev -w frontend`, `npm run watch -w packages/shared-types`, and `npm run storybook -w frontend` for component work.
- Quality gates live at the root: `npm run lint` (ESLint + Stylelint), `npm run typecheck`, `npm run format:check`.
- `npm run check:tailwind` scans `frontend/src` for Tailwind arbitrary values in `className` strings; mirrors the pre-commit hook. CI runs this as part of the Quality job matrix.

## Coding Style & Naming Conventions
- Prettier owns formatting (`tabWidth: 2`, single quotes, no trailing commas). Tailwind class ordering is handled by `prettier-plugin-tailwindcss`; run `npm run format` before pushing.
- ESLint focuses on TypeScript/React/a11y rules and general code quality; it does not validate Tailwind utility strings. Pre-commit enforces hard gates (e.g., `.only` in tests) and flags CommonJS `require()` usage.
- Tailwind guardrails: Avoid arbitrary values like `p-[13px]` and `text-[#333]`. These are blocked by a pre-commit check in staged frontend source files; CI continues to run lint/format checks.
- Stylelint lints CSS (root config extends `stylelint-config-tailwindcss`), but it does not validate Tailwind utility strings in JSX.
- Naming rules: PascalCase for types/interfaces, camelCase for variables and parameters, UPPER_CASE for enum members.

## Testing Guidelines
- Backend: `npm run test -w backend` (Jest) plus `npm run test:integration -w backend` for datastore and messaging flows.
- Frontend: `npm run test -w frontend` (Vitest), `npm run coverage -w frontend`, `npm run test:e2e -w frontend` (Playwright), and `npm run chromatic -w frontend` for visual baselines.
- Co-locate specs as `*.test.ts` or `*.spec.ts`; Husky blocks commits containing `.only` or missing `describe`/`it`. Place stories alongside components as `*.stories.tsx`.

## Commit & Pull Request Guidelines
- Follow the existing short, imperative commit subjects (e.g., `Fix pre-commit hook for workspaces`) and keep scope tight.
- Before opening a PR, run lint, typecheck, and the affected test targets; call out what you executed in the description.
- Link tickets, attach screenshots (or Chromatic diffs) for UI updates, and mention schema or contract changes explicitly.
- Husky pre-commit runs staged type checks, import validation, and console/log scans—treat warnings as merge blockers.

## Environment & Integration Tips
- Start dependencies with `docker-compose up -d`; credentials are defined beside each service in the compose file.
- Load secrets through ignored `.env` files consumed by backend config loaders and Vite `import.meta.env`.
- Use Node.js 20+ to match workspace `engines` and avoid type incompatibilities during CI.

## Visual Guardrails
- Import `@integrapcs/design-tokens/tokens.css` (or the `frontend/src/styles/tokens.css` re-export) before authoring UI. Allowed utilities: `bg-brand-500`, `text-neutral-900`, spacing `{1,2,3,4,6,8}`, typography `{text-scale-0, text-scale-1, text-scale-2}`, `rounded-2`, `shadow-1`.
- Do not use inline styles or Tailwind arbitrary values (e.g., `p-[13px]`, `text-[#333]`). The pre-commit hook blocks these in staged frontend source; Prettier orders classlists.
- CI enforces the no-arbitrary-values policy using `npm run check:tailwind`. The check mirrors the pre-commit hook and only scans `className` lines in `frontend/src`. For temporary exceptions, add entries to `scripts/config/tailwind-arbitrary-allowlist.json` (include a clear `reason` and remove the entry promptly).
- Prefer composing existing components in `src/components` rather than bespoke markup.
- Uphold accessibility in generated output (semantic structure, labelled controls, focus states, descriptive alt text).
- Add or update a Storybook story for every new visual component to keep Chromatic baselines current.
