# Bridging schedNeoOrg FE Patterns to integraPCS Styling

Audience: Frontend developers who are asked to "look at how a feature works in schedNeoOrg FE" and then implement the same feature in integraPCS using the integraPCS styling framework.

Objective: Understand the differences between the two systems, what you can reuse (logic, composition) and what you must adapt (styling), plus a set of mappings and examples so you can implement integraPCS-compliant code quickly.

---

## TL;DR

- Use schedNeoOrg for high‑level UI logic and composition patterns, not for styling classes.
- integraPCS is Tailwind v4, token-first, CVA-driven, and enforces strict Tailwind linting (no arbitrary values, no custom classnames).
- Replace schedNeoOrg’s ad-hoc styles (e.g., `text-[11px]`, direct colors like `text-red-600`) with integraPCS tokens and CVA variants (e.g., `text-2xs`, `text-error-500`, `pillVariants`, `panelVariants`, `tableVariants`, `inputVariants`).
- Keep the current global neutral border behavior (no changes needed in globals.css).
- Use `cn` for class merging and let Tailwind v4 tokens drive utilities.

---

## The Two Styling Systems at a Glance

- integraPCS
  - Tailwind v4 + `@tailwindcss/postcss`
  - Token-first via `@theme` in CSS with OKLCH color space
  - Strict ESLint with Tailwind plugin guardrails
  - CVA variants for repeatable UI patterns
  - Key files:
    - Frontend tokens:
      `/Users/stormac/programCursor/integraPCS/frontend/src/styles/tokens.css`
    - Global base styles:
      `/Users/stormac/programCursor/integraPCS/frontend/src/styles/globals.css`
    - CVA variants:
      `/Users/stormac/programCursor/integraPCS/frontend/src/lib/cva.ts`
    - `cn` utility:
      `/Users/stormac/programCursor/integraPCS/frontend/src/lib/cn.ts`
    - ESLint rules (Tailwind guardrails included):
      `/Users/stormac/programCursor/integraPCS/frontend/eslint.config.js`

- schedNeoOrg
  - Tailwind v3 + traditional `tailwind.config.js`
  - Theming via CSS vars in `:root` (HSL)
  - shadcn/ui components with inline variant objects
  - Fewer Tailwind lint guardrails
  - Representative files to study patterns (not styles to copy):
    - Theme sources:
      `/Users/stormac/programCursor/schedNeoOrg/frontend/src/index.css`
      `/Users/stormac/programCursor/schedNeoOrg/frontend/tailwind.config.js`
    - Utilities and UI:
      - `cn`: `/Users/stormac/programCursor/schedNeoOrg/frontend/src/lib/utils.ts`
      - Button example: `/Users/stormac/programCursor/schedNeoOrg/frontend/src/components/ui/button.tsx`
    - GridView feature (for real-world patterns):
      `/Users/stormac/programCursor/schedNeoOrg/frontend/src/features/GridView/components/LineItemsPanel/LineItemsPanel.tsx`
      `/Users/stormac/programCursor/schedNeoOrg/frontend/src/features/GridView/components/LineItemsPanel/LineItemsTaskGroup.tsx`

---

## What to Borrow from schedNeoOrg

Good to reuse as inspiration:
- Component composition and data flow (Dialogs, panels, lists/tables, summary badges)
- UX patterns (empty states, loading states, move dialogs, grouping by task)
- `cn` usage pattern (merge utilities conditionally)

What NOT to copy verbatim:
- Tailwind class strings (many are not tokenized and will fail lint in integraPCS)
- Arbitrary values like `text-[11px]`
- Direct palette references like `text-red-600`

Instead: Use integraPCS tokens and CVA variants.

---

## integraPCS Tokens and Variants You’ll Use Most

All defined in:
- Tokens: `/frontend/src/styles/tokens.css`
- CVA Variants: `/frontend/src/lib/cva.ts`
- `cn` utility: `/frontend/src/lib/cn.ts`

Key token families (examples):
- Colors (OKLCH): `brand-*`, `neutral-*`, `success-*`, `warning-*`, `error-*`
- Semantic aliases: `surface`, `surface-muted`, `surface-inverse`, `border`, `border-muted`, `border-strong`, `foreground-muted`, `foreground-subtle`, `foreground-inverse`
- Typography: `text-2xs`, `text-xs`, `text-sm`… (`text-2xs` replaces `text-[11px]`)
- Radii and shadows: `rounded-xl`, `shadow-sm` etc.

Key CVA variants:
- `panelVariants` — consistent cards/panels with tone, elevation, padding, dashed
- `pillVariants` — summary chips for totals by type
- `inputVariants` — standard input shells and focus rings
- `tableVariants` — density and border options for tables

---

## Quick Mapping: schedNeoOrg → integraPCS

Use these mappings to rewrite styles:

- Typography
  - `text-[11px]` → `text-2xs`
- Colors
  - `text-red-600` → `text-error-500` (or a neutral message using `text-foreground-muted` where appropriate)
  - `bg-muted/10` → `bg-surface-muted/10` (prefer semantic alias)
  - `border` with custom shades → `border-border`, `border-border/50`, or `border-border-muted`
- Pills / Chips
  - Ad-hoc: `rounded border border-border/50 px-3 py-2 text-[11px]`
  - Use: `pillVariants({ size: 'xs', variant: 'neutral' })`
- Panels / Cards
  - Ad-hoc: `rounded-md border border-border/60 bg-white px-3 py-2 shadow-sm`
  - Use: `panelVariants({ tone: 'default', elevation: 'sm', padding: 'sm' })`
- Tables
  - Use `tableVariants({ density: 'compact', borders: 'row', headerTone: 'default' })`
- Inputs
  - Use `inputVariants({ size: 'md', invalid: false })`

Lint reminders (already enforced in integraPCS):
- No arbitrary values (e.g., `text-[11px]`) → use tokenized utilities (e.g., `text-2xs`)
- No custom classnames → use Tailwind utilities + tokens + CVA

---

## Concrete Examples

### 1) "By-Type Summary" chips (GridView pattern)

schedNeoOrg example class patterns appear in:
- LineItemsPanel.tsx: summary blocks using `text-[11px]`, borders, and small chips
- LineItemsTaskGroup.tsx: repeated ad-hoc chip-like blocks

integraPCS approach with `pillVariants`:

```tsx
import { pillVariants } from '@/lib/cva';
import { cn } from '@/lib/cn';

type Currency = 'USD' | 'EUR' | 'SEK' | 'NOK' | 'DKK';
type TotalsByType = Record<string, { total: number }>;

export function ByTypeSummary({
  byType,
  grandTotal,
  currency,
  formatAmount
}: {
  byType: TotalsByType;
  grandTotal: number;
  currency: Currency;
  formatAmount: (value: number, currency: Currency) => string;
}) {
  const typeToVariant: Record<string, NonNullable<Parameters<typeof pillVariants>[0]>['variant']> = {
    material: 'brand',
    labor: 'success',
    equipment: 'warning',
    other: 'neutral'
  };

  return (
    <div className={cn('flex flex-row flex-wrap items-center gap-2')}>
      {Object.entries(byType).map(([type, agg]) => (
        <span
          key={type}
          className={pillVariants({ size: 'xs', variant: typeToVariant[type] ?? 'neutral' })}
        >
          <span className="font-medium">{type} {formatAmount(agg.total, currency)}</span>
        </span>
      ))}
      <span className={pillVariants({ size: 'xs', variant: 'neutral' })}>
        <span className="font-medium">total {formatAmount(grandTotal, currency)}</span>
      </span>
    </div>
  );
}
```

Result:
- No arbitrary font size, consistent borders and colors via tokens
- Reusable across panels

---

### 2) Panel shell for task groups

schedNeoOrg-like class bundle:
```
"space-y-3 rounded-md border border-border/60 bg-white px-3 py-2 shadow-sm"
```

integraPCS with `panelVariants`:

```tsx
import { panelVariants } from '@/lib/cva';
import { cn } from '@/lib/cn';

export function TaskGroupPanel({ children }: { children: React.ReactNode }) {
  return (
    <section className={cn(panelVariants({ tone: 'default', elevation: 'sm', padding: 'sm' }), 'space-y-3')}>
      {children}
    </section>
  );
}
```

- Use `dashed: true` when you need dashed borders.
- Switch `tone` to `muted` for muted sections (e.g., side summaries).

---

### 3) Table density and borders

integraPCS with `tableVariants`:

```tsx
import { tableVariants } from '@/lib/cva';
import { cn } from '@/lib/cn';

export function CompactTableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(tableVariants({ density: 'compact', borders: 'row', headerTone: 'default' }))}>
      {children}
    </div>
  );
}
```

- Density presets map directly onto the typography scale: `compact` → `text-sm` (12px), `normal` → `text-base` (14px), `spacious` → `text-lg` (16px).
- Status badges inherit size from the active density so their footprint tracks the table: `compact` → `size="sm"`, `normal` → `size="md"`, `spacious` → `size="lg"`.
- Row padding follows the spacing tokens: `compact` → `py-1`, `normal` → `py-2`, `spacious` → `py-3`.

---

### 4) Input shells with consistent focus and invalid states

integraPCS with `inputVariants`:

```tsx
import { inputVariants } from '@/lib/cva';
import { cn } from '@/lib/cn';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputVariants({ size: 'md', invalid: false }))} {...props} />;
}
```

Set `invalid: true` to get error-border + error ring from tokens.

---

## How to Work When Pointed to schedNeoOrg

1) Locate the feature in schedNeoOrg
- Identify the relevant files and components (e.g., for GridView: LineItemsPanel and LineItemsTaskGroup).
- Focus on data flow, component structure, and UI states (loading, empty, error, dialogs).

2) Extract the UI intent, not the classes
- Note what elements exist (panels, chips/pills, tables, inputs).
- Note behaviors (move dialogs, selection, summaries).

3) Apply integraPCS building blocks
- Panels → `panelVariants`
- Summary chips → `pillVariants` (size `xs` for compact chips)
- Table density and borders → `tableVariants`
- Inputs → `inputVariants`
- Typography → `text-2xs`, `text-xs`, `text-sm`… never `text-[11px]`

4) Keep semantics consistent
- Use `text-foreground-muted` for muted text and `text-error-500` for errors.
- Prefer `bg-surface`/`bg-surface-muted` and `border-border`/`border-border-muted`.

5) Validate with lint + preview
- Run `pnpm run lint` / `npm run lint` to catch arbitrary values and custom classes.
- Preview in the app; tokens should create consistent visuals.

---

## Common Pitfalls and Fixes

- Arbitrary values (e.g., `text-[11px]`) → Use `text-2xs`.
- Direct palette references (e.g., `text-red-600`) → Use semantic `text-error-500`, or neutrals (`text-foreground-muted`) as appropriate.
- Hand-built "chip" blocks → Use `pillVariants`.
- Hand-built panel compositions → Use `panelVariants` + a small wrapper `cn(panelVariants({ ... }), 'optional-layout-classes')`.
- Mixed spacing/padding tokens → Use `panelVariants.padding` or concise utilities (`p-2`, `p-3`, `p-4`) that align with tokens.

---

## Empty, Loading, and Error States (Token-first)

- Empty state (neutral):
```tsx
<div className="text-center py-8 text-foreground-muted">
  Nothing here yet. Add your first item.
</div>
```

- Loading state:
```tsx
<div className="py-6 text-center text-sm text-foreground-muted">Loading...</div>
```

- Error state (semantic):
```tsx
<div className="py-6 text-center text-sm text-error-500">
  Failed to load. Please try again.
</div>
```

---

## Quick "Search-and-Replace" Checklist

When porting patterns from schedNeoOrg:

- Typography
  - Find: `text-[11px]` → Replace: `text-2xs`

- Colors
  - Find: `text-red-600` → Replace: `text-error-500`
  - Find: `bg-muted/...` → Replace: `bg-surface-muted/...`

- Chips/Pills
  - Find: `rounded border ... px-3 py-2 text-[11px]` → Replace: `pillVariants({ size: 'xs', variant: 'neutral' })`

- Panels
  - Find: `rounded-md border ... bg-white px-3 py-2 shadow-sm` → Replace: `panelVariants({ tone: 'default', elevation: 'sm', padding: 'sm' })`

- Tables
  - Wrap tables or containers with: `tableVariants({ density: 'compact', borders: 'row', headerTone: 'default' })`

- Inputs
  - Replace ad-hoc inputs with: `inputVariants({ size: 'md', invalid: false })`

---

## Where to Look (Paths Recap)

- integraPCS
  - Tokens:
    `/Users/stormac/programCursor/integraPCS/frontend/src/styles/tokens.css`
  - Global base CSS:
    `/Users/stormac/programCursor/integraPCS/frontend/src/styles/globals.css`
  - CVA variants + types:
    `/Users/stormac/programCursor/integraPCS/frontend/src/lib/cva.ts`
  - `cn` helper:
    `/Users/stormac/programCursor/integraPCS/frontend/src/lib/cn.ts`
  - ESLint config (Tailwind rules):
    `/Users/stormac/programCursor/integraPCS/frontend/eslint.config.js`

- schedNeoOrg (for reference only)
  - Tailwind/HSL theme:
    `/Users/stormac/programCursor/schedNeoOrg/frontend/src/index.css`
    `/Users/stormac/programCursor/schedNeoOrg/frontend/tailwind.config.js`
  - Utilities/UI:
    `/Users/stormac/programCursor/schedNeoOrg/frontend/src/lib/utils.ts`
    `/Users/stormac/programCursor/schedNeoOrg/frontend/src/components/ui/button.tsx`
  - GridView examples:
    `/Users/stormac/programCursor/schedNeoOrg/frontend/src/features/GridView/components/LineItemsPanel/LineItemsPanel.tsx`
    `/Users/stormac/programCursor/schedNeoOrg/frontend/src/features/GridView/components/LineItemsPanel/LineItemsTaskGroup.tsx`

---

## Final Notes

- The integraPCS system already contains the tokens and variants you need. If you encounter a styling need that seems to require arbitrary values, first look for an existing token or extend `cva.ts` with a new, minimal variant that still adheres to tokens.
- The current global neutral behavior is intentional; component-level semantics are applied via tokens and CVA.
- If you’re unsure which token or variant to use, start from the closest `panelVariants`, `pillVariants`, `inputVariants`, or `tableVariants` preset and adjust via safe utilities (`gap-2`, `p-2`, etc.).

Happy porting!
