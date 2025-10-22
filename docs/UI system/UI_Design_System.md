Token-based design system with utility-first CSS
 The project use a_ **_design token system with Tailwind CSS v4 and CVA (Class Variance Authority) for our component variants. Our tokens are defined in a shared package and_**   consumed by Tailwind's @theme directive. We maintain a **component library documented in Storybook, with automated demos synced from our design tokens."**
 
  **Design Token System**
  - Industry-standard approach for managing design decisions as data
  - Platform-agnostic variables (colors, spacing, typography) that can be consumed by any framework
  - Your @integrapcs/design-tokens package is a **design token library**
  **Utility-First CSS** **(via Tailwind v4)**
  - Atomic CSS methodology
  - Small, single-purpose utility classes
  - Tailwind CSS is the most popular utility-first framework

  **Design System** **or Component Library**
  - Collection of reusable components built with design tokens
  - Your CVA-based Button, Card, Badge components form a **component library**
  - Storybook serves as your **component catalog** or **pattern library**

  **Theme/Theming System**
  - Using CSS custom properties (@theme in Tailwind v4)
  - Allows runtime theme switching if needed

  **5. Specific Implementation:**
  - **"Tailwind v4 with custom design tokens"**
  - **"Token-driven design system"**
  - **"Design token-based component library"**
  - **"Constraint-based design system"** (limited token palette for consistency)

**Typography Token System**

- Tailwind v4 token naming
  - Text utilities read CSS custom properties named `--text-sm`, `--text-base`, and `--text-lg`.
  - Our tokens define a constrained 3-step scale and map it to Tailwind’s semantic utilities:
    ```css
    @theme {
      /* Tokenized scale */
      --text-scale-0: 0.75rem;
      --text-scale-1: 0.875rem; 
      --text-scale-2: 1rem;

      /* Tailwind v4 semantic hooks */
      --text-sm: var(--text-scale-0);   
      --text-base: var(--text-scale-1); 
      --text-lg: var(--text-scale-2);   

      /* System-wide line heights */
      --text-sm--line-height: 1.3;
      --text-base--line-height: 1.3;
      --text-lg--line-height: 1.3;
    }
    ```
- Semantic utilities → rendered sizes
  - `text-sm` 
  - `text-base` 
  - `text-lg` 
  - Always prefer semantic utilities so components inherit global typography from design tokens.

**Global line-height (1.3)**
- Every text utility resolves `line-height: 1.3` via the `--text-*--line-height` tokens; verify by inspecting any `.text-base` element in devtools.
- Global adjustments belong in `packages/design-tokens/src/tokens.css`; update the line-height tokens there rather than overriding individual components.
- After changing tokens, regenerate the visual demos (`npm run generate:demos`) so the static HTML stays in sync.

- Developer guidance
  - Do:
    - Use `text-sm`, `text-base`, `text-lg` for typography. These are powered by the tokens above.
    - If you need to adjust sizes globally, change the token values in the `@theme` block, don't use per-component overrides.
  - Avoid:
    - Arbitrary classes
    - Introducing extra text sizes
  - Verification tips:
    - In devtools, `.text-sm` should resolve to `font-size: var(--text-sm);` and compute to 12px.
    - Line height should resolve to the shared `1.3` token (e.g., `.text-base` → `line-height: 1.3`).
    - Ensure the design-tokens stylesheet is imported before authoring UI so variables are available.
