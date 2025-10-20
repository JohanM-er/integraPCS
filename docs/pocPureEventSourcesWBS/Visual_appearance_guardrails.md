Visual appearance guardrails setup 

# Targets
- Single source of truth for tokens.
- Utilities only. No ad-hoc styles.
- Lint gates to block drift.
- Visual and a11y tests in CI.
- Clear rules for human devs and AI agents.
# 1) Design tokens in Tailwind

Use Tailwind v4 `@theme` to define color/spacing/type once. This becomes the only allowed palette. ([Tailwind CSS](https://tailwindcss.com/docs/theme?utm_source=chatgpt.com "Theme variables - Core concepts"))

`src/styles/tokens.css`

```css
@import "tailwindcss";

@theme {
  /* colors */
  --color-brand-500: oklch(0.72 0.11 178);
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
  --radius-2: 0.5rem;
  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.06);
}
```

Now only classes like `bg-brand-500`, `text-neutral-900`, `p-4`, `rounded-2` are valid and discoverable. ([Tailwind CSS](https://tailwindcss.com/docs/theme?utm_source=chatgpt.com "Theme variables - Core concepts"))

# 2) ESLint guardrails for Tailwind usage
Block arbitrary values and unknown classnames. Enforce class sorting.
`.eslintrc.cjs`

```js
module.exports = {
  extends: ["next/core-web-vitals", "plugin:jsx-a11y/recommended"],
  plugins: ["tailwindcss"],
  rules: {
    "tailwindcss/no-arbitrary-value": "error",
    "tailwindcss/no-custom-classname": ["error", { whitelist: [] }],
    "tailwindcss/classnames-order": "warn"
  }
};
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
  extends: ["stylelint-config-recommended", "stylelint-config-tailwindcss"],
};
```

This combo understands `@tailwind`, `@layer`, `@apply`. ([npm](https://www.npmjs.com/package/stylelint-config-tailwindcss?utm_source=chatgpt.com "stylelint-config-tailwindcss"))

# 4) Prettier + sorting

Install Prettier and the Tailwind class sorter so diffs stay clean.
`.prettierrc`
```json
{ "plugins": ["prettier-plugin-tailwindcss"] }
```
(Prettier plugin sorts utilities; complements the ESLint rule.) ([Wisp](https://www.wisp.blog/blog/best-practices-for-using-tailwind-css-in-large-projects?utm_source=chatgpt.com "Best Practices for Using Tailwind CSS in Large Projects"))

# 5) Component library + visual tests
- Build canonical components in Storybook.
- Use Chromatic for CI visual regression on PRs.  
    `.github/workflows/chromatic.yml`
    
```yaml
name: chromatic
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build-storybook
      - uses: chromaui/action@v1
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

This auto-publishes Storybook and blocks regressions. ([chromatic.com](https://www.chromatic.com/docs/github-actions/?utm_source=chatgpt.com "Automate Chromatic with GitHub Actions"))
Optional page-level snapshots with Playwright:

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
`package.json` (excerpt)

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js && stylelint \"**/*.{css,pcss}\"",
    "format": "prettier -w .",
    "test:ui": "playwright test -c tests/ui",
    "typecheck": "tsc --noEmit"
  },
  "lint-staged": {
    "*.{ts,tsx,js}": ["eslint --fix"],
    "*.{css,pcss}": ["stylelint --fix"],
    "*": ["prettier -w"]
  }
}
```

CI job order: install → `typecheck` → `lint` → `format:check` → Storybook build → Chromatic → Playwright.

# 8) `AGENT.md` (instructions for AI codegen)

Put this in repo root. It prevents drift.

`AGENT.md`

```
Objective: Generate React + Tailwind UI that adheres to our design system with zero visual drift.

Hard rules:
1) Use only Tailwind utilities from the configured tokens in src/styles/tokens.css.
2) Do NOT use inline styles, CSS-in-JS, or arbitrary values like p-[13px], bg-[#123456]. They fail lint.
3) Use spacing {1,2,3,4,6,8}. Use text-scale {0,1,2}. Use color {brand-500, neutral-50, neutral-900}. No others.
4) Components must be composed from our library in /src/components when available.
5) Class order does not matter to you. Prettier sorts it.
6) Accessibility: include roles, labels, focus states; prefer semantic elements; images need alt.
7) Output only code. No commentary.

Allowed examples:
- OK: <button class="px-4 py-2 rounded-2 bg-brand-500 text-neutral-50 shadow-1">...</button>
- BAD: <button style="padding:13px;background:#123456">...</button>
- BAD: <div class="mt-[3px] text-[#333]">...</div>
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