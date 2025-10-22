### Design System Enforcement

This repository enforces design system practices through a combination of documentation, author-time tooling, pre-commit gates, CI checks, and a small set of component/CVA primitives. 

1) Policy and guidance (documentation)
- Source of truth: AGENTS.md
  - Codifies visual guardrails, “allowed utilities,” and the limited token set.
  - Clarifies responsibilities:
    - ESLint focuses on code quality (TypeScript/React/a11y) and does not validate Tailwind utility strings.
    - Prettier handles Tailwind class ordering via prettier-plugin-tailwindcss.
    - Pre-commit blocks Tailwind arbitrary values in staged frontend source files.
  - Provides concrete mappings and examples for porting UI patterns into the token/CVA system.
- Additional docs under docs/ outline setup, guardrails, and process (e.g., UI system guidance, infra, testing).

2) Author-time formatting and linting
- Prettier
  - Root configuration: .prettierrc.json
    - Includes prettier-plugin-tailwindcss to order Tailwind class strings consistently.
- ESLint (frontend)
  - Config: frontend/eslint.config.js
  - Scope: general code quality for TS/JS/React/a11y with @typescript-eslint, react-hooks, react-refresh, jsx-a11y, and prettier.
  - Notably absent: no Tailwind ESLint plugin is enabled; ESLint does not attempt to validate Tailwind class strings or arbitrary values.
- Stylelint
  - Root: stylelint.config.cjs extends stylelint-config-recommended and stylelint-config-tailwindcss for CSS files in the repo at large.
  - Frontend workspace: frontend/.stylelintrc.json extends stylelint-config-recommended (not Tailwind-aware) and ignores Tailwind at-rules to avoid false positives. It lints CSS files under src but does not validate JSX class strings.

3) Pre-commit enforcement (hard and soft gates)
- Hook: .husky/pre-commit
- Blocking gates
  - .only in tests: check_test_only exits with failure if found.
  - Tailwind arbitrary values in JSX className strings: check_tailwind_arbitrary_values scans staged frontend/src/**/*.ts,tsx,js,jsx and fails on bracketed arbitrary values (e.g., p-[13px], text-[#333], bg-[#123456]).
    - Targets only lines containing className to reduce false positives.
- Advisory (warnings; do not block commit)
  - Console.log in tests: flagged as warnings.
  - Basic test structure (describe/it/test) and TODO/FIXME checks.
  - TypeScript compilation for staged workspaces (backend, frontend, shared-types): warns on errors, prints a short snippet.
  - require() usage in source files: warns and lists locations (config files are excluded).
- Net effect
  - Arbitrary Tailwind values are stopped at commit time for the frontend.
  - Test focus leaks (.only) are prevented.
  - Other issues are surfaced early but do not block commits.

4) CI verification and build gates
- Workflow: .github/workflows/ci.yml
  - Security audit job: npm audit --audit-level=high blocks on high/critical vulnerabilities.
  - Code quality matrix: runs lint, format:check (Prettier), and typecheck across workspaces.
    - Since ESLint does not include Tailwind rules, no Tailwind-specific class validation happens here.
  - Tailwind arbitrary values check (check:tailwind): mirrors the pre-commit logic by scanning only className lines in frontend/src for bracketed arbitrary classes (e.g., p-[13px], text-[#333]) and prevents bypass via `git commit -n` or web-based merges. Temporary exceptions can be added to `scripts/config/tailwind-arbitrary-allowlist.json` (include a clear reason and remove promptly).
  - Unit tests: backend and frontend run in parallel; shared types are built first; coverage uploaded to Codecov when available.
  - Integration tests: spins Neo4j/Redis/RabbitMQ services; runs backend integration tests.
  - E2E tests: installs Playwright browsers; runs frontend test:e2e.
  - Build verification: runs npm run build across workspaces; uploads built artifacts.
- Chromatic publication
  - Separate workflow: .github/workflows/chromatic.yml
  - Builds Storybook for frontend and publishes to Chromatic via chromaui/action@v1.
  - Enforced gating: The workflow is configured with exitZeroOnChanges: false, causing the job to fail when visual changes are detected.
  - onlyChanged: true is enabled so Chromatic snapshots only stories affected by changes for faster runs.
  - After diffs are approved in Chromatic, the GitHub job must be re-run (or a new commit must retrigger CI) for the status to pass.
  - Note: GitHub branch protection must be configured manually to require the Chromatic status check/job on protected branches.

5) Design token foundation
- Package: packages/design-tokens/src/tokens.css
  - Tailwind v4 @theme block defines limited tokens for color, spacing, typography (including shared line-height), radius, and shadow.
  - The specific values live in the design instructions (`UI_Design_System_Instructions.md`); enforcement revolves around consuming those tokens rather than recreating utilities by hand.
  - No build step required; they are plain CSS.
- Frontend consumption
  - The frontend imports tokens (directly or via a local re-export) to ensure the utilities resolve under Tailwind v4’s token model.
- Enforcement status
  - Use of tokens is guided by documentation and component variants; there is no programmatic rule in ESLint/Stylelint to require token usage vs. arbitrary values. Arbitrary values are blocked by pre-commit, not by ESLint.

6) Component/CVA primitives (soft enforcement)
- Library: frontend/src/lib/cva.ts
  - cva-based variants define standardized class bundles tied to the token set:
    - buttonVariants: variant {primary, secondary, ghost, destructive, outline}; size {sm, md, lg}
    - cardVariants: padding {none, sm, md, lg}; hover {true}
    - badgeVariants: variant {neutral, brand, inverse}
    - panelVariants: tone {default, brand, inverse}; padding {none, sm, md, lg}; emphasis {true/false}
    - pillVariants: tone {neutral, brand}; interactive {true/false}
    - inputVariants: size {sm, md, lg}; invalid {true/false}
    - tableVariants: density {compact, normal, spacious}; borders {row, all, none}; headerTone {default, none}
      - Typography scale baked in: `compact` → `text-sm` (12px), `normal` → `text-base` (14px), `spacious` → `text-lg` (16px)
      - Density also sets table cell padding via spacing tokens: `compact` → `py-1`, `normal` → `py-2`, `spacious` → `py-3`
      - Connected components (e.g., WorkPackageGrid badges) scale in lockstep with density (`sm`/`md`/`lg`)
  - Example usage in components: Button.tsx uses buttonVariants to enforce design system variants at the component level.
- Enforcement status
  - Adoption of CVA variants is encouraged and documented. There is no automated lint rule forcing usage across arbitrary components; compliance relies on convention and code review.

7) Visual system demos
- Script: scripts/generate-token-demos.mjs
  - Reads live tokens and button sizes from CVA to generate docs/WorkPackFeature/demos/limited-token-guidelines.html.
  - Demonstrates token values and CVA-driven size mapping.
- Enforcement status
  - Manual tool; not wired into CI to enforce freshness or fail on drift.

8) What is hard vs. soft enforced today
- Hard enforcement
  - Pre-commit blocks:
    - Tailwind arbitrary values in className strings (frontend/src only).
    - .only in tests.
  - CI blocks:
    - High/critical npm audit issues.
    - Tailwind arbitrary values policy (check:tailwind) — blocks CI when bracketed arbitrary classes are detected in className within frontend/src; see `scripts/config/tailwind-arbitrary-allowlist.json` for temporary exceptions.
    - Type errors and ESLint/Stylelint/Prettier failures (within configured scope).
    - Failing unit/integration/E2E test suites.
    - Chromatic visual regression gating:
      - The chromatic workflow fails when visual changes are detected (exitZeroOnChanges: false).
      - PRs remain blocked until diffs are reviewed/approved in Chromatic and the job is re-run (or a new commit retriggers CI).
      - Branch protection must require the Chromatic status check/job to pass on protected branches.
- Soft enforcement
  - Token-first usage and allowed utilities via documentation and CVA variants.
  - Tailwind class ordering via Prettier (non-blocking unless format:check fails in CI).

Key takeaways
- Arbitrary Tailwind values are actively prevented at commit time for frontend source files (pre-commit), which is the primary "design system" enforcement mechanism in practice.
- ESLint and Stylelint are intentionally focused on code and raw CSS linting respectively; they do not validate Tailwind class strings in JSX. Prettier handles class ordering.
- The design token system and CVA primitives exist and are used, with Button as a concrete example; however, component-level adherence is policy-driven, not enforced by automated rules.
- Chromatic is now a hard gate: the chromatic workflow fails on visual diffs, protected branches should require the Chromatic status check/job, and after approval in Chromatic the CI job must be re-run or a new commit must retrigger CI for the check to pass.
