Visual appearance guardrails setup 

# Targets
- Single source of truth for tokens.
- Utilities only. No ad-hoc styles.
- Lint gates to block drift.
- Visual and a11y tests in CI.
- Clear rules for human devs and AI agents.
# 1) Design tokens in Tailwind

Use Tailwind v4 `@theme` to define color/spacing/type once. This becomes the only allowed palette. ([Tailwind CSS](https://tailwindcss.com/docs/theme?utm_source=chatgpt.com "Theme variables - Core concepts"))

`packages/design-tokens/src/tokens.css`

```css
@import "tailwindcss";

@theme {
  /* colors */
  --color-brand-500: oklch(0.6728 0.0888 232.28);
  --color-neutral-50:  oklch(0.98 0.01 95);
  --color-neutral-900: oklch(0.21 0.02 95);

  /* spacing scale */
  --spacing-0: 0;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;

  /* typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  --text-scale-0: 0.875rem;
  --text-scale-1: 1rem;
  --text-scale-2: 1.125rem;
  --font-size-sm: var(--text-scale-0);
  --font-size-base: var(--text-scale-1);
  --font-size-lg: var(--text-scale-2);
  --radius-2: 0.5rem;
  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.06);
}
```

The Vite app simply re-exports this package in `frontend/src/styles/tokens.css`:

```css
@import "@integrapcs/design-tokens/tokens.css";
```

Now only classes like `bg-brand-500`, `text-neutral-900`, `p-4`, `rounded-2` are valid and discoverable. ([Tailwind CSS](https://tailwindcss.com/docs/theme?utm_source=chatgpt.com "Theme variables - Core concepts"))

# 2) ESLint guardrails for Tailwind usage
Block arbitrary values and unknown classnames. Enforce class sorting.
`frontend/eslint.config.js`

```ts
// excerpt
{
  files: ['**/*.{ts,tsx}'],
  plugins: {
    tailwindcss: tailwindPlugin
  },
  rules: {
    'tailwindcss/no-arbitrary-value': 'error',
    'tailwindcss/no-custom-classname': ['error', { whitelist: [] }],
    'tailwindcss/classnames-order': 'warn'
  }
}
```

- `no-arbitrary-value` forbids `bg-[#123456]`, `p-[13px]`.
- `no-custom-classname` limits classes to Tailwind utilities and your configured tokens.
- `classnames-order` keeps consistency. ([npm](https://www.npmjs.com/package/eslint-plugin-tailwindcss?utm_source=chatgpt.com "eslint-plugin-tailwindcss"))

Add a11y linting baseline via `eslint-plugin-jsx-a11y`. ([GitHub](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y?utm_source=chatgpt.com "jsx-eslint/eslint-plugin-jsx-a11y: Static AST checker for ..."))

# 3) Stylelint for author CSS

Catches unknown at-rules and keeps any needed CSS sane.
`stylelint.config.cjs`

```js
module.exports = {
  extends: ['stylelint-config-recommended', 'stylelint-config-tailwindcss'],
  rules: {
    'color-function-notation': null
  },
  ignoreFiles: ['**/dist/**', '**/node_modules/**']
};
```

Extending the Tailwind preset keeps `@tailwind`, `@layer`, and `@apply` valid while the extra rule allows our OKLCH palette. ([npm](https://www.npmjs.com/package/stylelint-config-tailwindcss?utm_source=chatgpt.com "stylelint-config-tailwindcss"))

# 4) Prettier + sorting

Install Prettier and the Tailwind class sorter so diffs stay clean.
`.prettierrc`
```json
{ "plugins": ["prettier-plugin-tailwindcss"] }
```
(Prettier plugin sorts utilities; complements the ESLint rule.) ([Wisp](https://www.wisp.blog/blog/best-practices-for-using-tailwind-css-in-large-projects?utm_source=chatgpt.com "Best Practices for Using Tailwind CSS in Large Projects"))

# 5) Component library + visual tests
- Build canonical components in Storybook (`frontend/.storybook/`). The default button story looks like this:

    ```ts
    export const Primary = { args: { variant: 'primary', children: 'Primary Action' } };
    ```

- Use Chromatic for CI visual regression on PRs.  
    `.github/workflows/chromatic.yml`
    
    ```yaml
    name: chromatic
    on:
      pull_request:
      push:
        branches:
          - main
    jobs:
      chromatic:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with:
              node-version: 20
          - run: npm install
          - run: npm run build:shared --if-present
          - run: npm run storybook:build -w frontend
          - uses: chromaui/action@v1
            with:
              projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
              workingDir: frontend
    ```

This auto-publishes Storybook and blocks regressions. ([chromatic.com](https://www.chromatic.com/docs/github-actions/?utm_source=chatgpt.com "Automate Chromatic with GitHub Actions"))

Complement Chromatic with high-signal Playwright snapshots when a full page scenario matters:

```ts
import { test, expect } from '@playwright/test';

test('home layout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('home.png');
});
```

([Playwright](https://playwright.dev/docs/test-snapshots?utm_source=chatgpt.com "Visual comparisons"))

# 6) Token pipeline from design tools (optional)

If design owns tokens in Figma, sync via Style Dictionary to emit CSS variables consumed by Tailwind v4. ([Style Dictionary](https://styledictionary.com/getting-started/examples/?utm_source=chatgpt.com "Examples"))

# 7) CI enforcement

Use Husky + lint-staged to block non-conforming diffs.
`frontend/package.json` (excerpt)

```json
{
  "scripts": {
    "lint": "eslint . && stylelint \"src/**/*.{css}\"",
    "lint:fix": "eslint . --fix && stylelint \"src/**/*.{css}\" --fix",
    "lint:css": "stylelint \"src/**/*.{css}\"",
    "storybook": "storybook dev -p 6006",
    "storybook:build": "storybook build",
    "chromatic": "chromatic --project-token $CHROMATIC_PROJECT_TOKEN"
  },
  "lint-staged": {
    "*.{js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{css}": ["stylelint --fix", "prettier --write"],
    "*.{json,md}": "prettier --write"
  }
}
```

CI job order: install → `typecheck` → `lint` → `format:check` → Storybook build → Chromatic → Playwright.

# 8) `AGENTS.md` (instructions for AI codegen)

The repo root `AGENTS.md` mirrors these guardrails so human and AI contributors share one contract:

```
## Visual guardrails for generated UI
- Use only Tailwind utilities backed by @integrapcs/design-tokens (`bg-brand-500`, `p-4`, `rounded-2`, etc.).
- No inline styles or Tailwind arbitrary values like p-[13px] or text-[#333]; ESLint + Stylelint will fail them.
- Spacing tokens: {1,2,3,4,6,8}. Typography tokens: {text-scale-0,text-scale-1,text-scale-2}. Radius: rounded-2. Shadow: shadow-1.
- Prefer composing existing components from src/components (e.g., Button) before hand-rolling new markup.
- Uphold accessibility: semantic elements, explicit labels, focus states, alt text on images.
- Ship a matching Storybook story whenever you introduce a new visual component.
```

Lint rules backstop these constraints. ([npm](https://www.npmjs.com/package/eslint-plugin-tailwindcss?utm_source=chatgpt.com "eslint-plugin-tailwindcss"))

# 9) Policy choices that reduce entropy

Adopt these defaults and ban the rest:

- Disallow Tailwind arbitrary values in CI. ([npm](https://www.npmjs.com/package/eslint-plugin-tailwindcss?utm_source=chatgpt.com "eslint-plugin-tailwindcss"))
    
- Ban custom CSS unless inside `@layer components` and reviewed.
    
- Require semantic component wrappers (Card, Button, Input) so color and spacing come from tokens.
    
- Require Storybook story per component with args and a11y coverage.
    

# 10) Minimal install list

```
tailwindcss @latest
eslint eslint-plugin-tailwindcss eslint-plugin-jsx-a11y
prettier prettier-plugin-tailwindcss
stylelint stylelint-config-recommended stylelint-config-tailwindcss
storybook @storybook/react-vite chromaui/action
@playwright/test
husky lint-staged typescript
```

Refs: Tailwind theme variables, ESLint Tailwind rules, Stylelint Tailwind config, jsx-a11y, Chromatic, Playwright, token pipelines. ([Tailwind CSS](https://tailwindcss.com/docs/theme?utm_source=chatgpt.com "Theme variables - Core concepts"))

If you want, I can output ready-to-paste files for a Next.js repo with these settings.
