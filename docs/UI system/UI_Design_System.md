Token-based design system with utility-first CSS
 The project use a_ **_design token system with Tailwind CSS v4 and CVA (Class Variance Authority) for our component variants. Our tokens are defined in a shared package and_**   consumed by Tailwind's @theme directive. We maintain a **component library documented in Storybook, with automated demos synced from our design tokens."**
 
  **1. Design Token System**
  - Industry-standard approach for managing design decisions as data
  - Platform-agnostic variables (colors, spacing, typography) that can be consumed by any framework
  - Your @integrapcs/design-tokens package is a **design token library**
  **2. Utility-First CSS** **(via Tailwind v4)**
  - Atomic CSS methodology
  - Small, single-purpose utility classes
  - Tailwind CSS is the most popular utility-first framework

  **3. Design System** **or Component Library**
  - Collection of reusable components built with design tokens
  - Your CVA-based Button, Card, Badge components form a **component library**
  - Storybook serves as your **component catalog** or **pattern library**

  **4. Theme/Theming System**
  - Using CSS custom properties (@theme in Tailwind v4)
  - Allows runtime theme switching if needed

  **5. Specific Implementation:**
  - **"Tailwind v4 with custom design tokens"**
  - **"Token-driven design system"**
  - **"Design token-based component library"**
  - **"Constraint-based design system"** (limited token palette for consistency)