# UI Design System Instructions

Use these instructions as the authoritative reference for building UI aligned with IntegraPCS tokens and component variants.

## Typography
- Tokens (in `packages/design-tokens/src/tokens.css`)
  - `--text-scale-0`, `--text-scale-1`, `--text-scale-2` map to 12 px, 14 px, 16 px.
  - Semantic hooks: `--text-sm`, `--text-base`, `--text-lg`.
  - Shared line height: `--text-*-–line-height` = 1.3.
- Usage
  - Prefer `text-sm`, `text-base`, or `text-lg`; avoid bespoke font-size utilities.
  - To change sizes globally, update the token values and allow Tailwind to regenerate utilities.
  - Confirm in devtools that `.text-base` resolves to 14 px / 1.3 line height.

## Spacing
- Token ladder: `--spacing-1…6` = 2 px, 3 px, 4 px, 8 px, 12 px, 18 px.
- Utilities (`p-*`, `py-*`, `gap-*`, etc.) inherit from these tokens; introduce new spacing values only by extending the token file.

# Table Surfaces & States

https://chatgpt.com/c/68f90e22-be50-832c-a8a8-a7cb7893df8a


This table system applies tokens for color and border styling (`surface-table`, `fg-table`, `border-table`) and uses `tableVariants` defaults to ensure spacing, header contrast, and row delineation are consistent with the design system. Only the “Status” column uses non-table component tokens.


| Element                                 | Example in image                                                  | Purpose                                                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Header row**                          | `ID`, `Name`, `Owner`, `Phase`, `Start`, `End`, `Status`, `Score` | Uses `bg-surface-table-header` and `text-fg-table-header`. Defines columns.                                                                                         |
| **Body rows**                           | Rows like `WP-1182 Turbine Alignment Review`                      | Use `bg-surface-table` for normal background and `text-fg-table` for text. Alternate rows may use `bg-surface-table-muted` if striping is enabled (not shown here). |
| **Borders**                             | Thin gray grid lines                                              | Controlled by `border-table`. The variant likely uses `borders: row` (horizontal lines only).                                                                       |
| **Status pills**                        | “On Track”, “At Risk”, “Blocked”, “Complete”                      | These are separate badge components. They don’t use table tokens; they use status tokens (e.g. `bg-status-ontrack`).                                                |
| **Header title “Operational Snapshot”** | Above the table                                                   | Outside the table token system; styled via standard heading tokens.                                                                                                 |
| **Region / Status / Owner chips**       | “Status: Active”, “Region: AMER”                                  | Not table elements. Likely separate badge components using global color tokens.                                                                                     |


**Token system**

| Token alias              | Function                           |
| ------------------------ | ---------------------------------- |
| `--surface-table`        | Default row background.            |
| `--surface-table-header` | Header background color.           |
| `--surface-table-muted`  | Alternate or hover row background. |
| `--fg-table`             | Normal row text color.             |
| `--fg-table-header`      | Header text color.                 |
| `--border-table`         | Border color between rows/columns. |

These tokens ensure table visuals stay consistent with the theme.

## tableVariants
The **tableVariants** function composes class sets automatically:
* `density`: controls padding (`compact`, `normal`, or `spacious`). The table shown looks `normal`.
* `headerTone`: here it’s `default` (header tone distinct from body).
* `borders`: appears set to `row`.
* `striped`, `hoverable`, `selectable`: all disabled in this example.
Developers should **use `tableVariants()`** instead of hard-coding class names, to stay consistent with design tokens and theme updates.

## PResence overlays

Presence overlays = visual, non-destructive highlights drawn above table cells to show collaborators.

**What each piece controls**

**Tokens**

  * `--presence-color`: base hue for a user.
  * `--presence-outline`: border color for focused cell.
  * `--presence-fill-alpha`: opacity for range fill.

**Utilities**

  * `.presence-overlay`: absolute, full-size layer anchor. Used on every overlay element.
  * `.presence-range`: translucent fill over a cell or multi-cell rect. Uses `--presence-color` + `--presence-fill-alpha`.
  * `.presence-outline`: 1–2px border around the active cell. Uses `--presence-outline`.
  * `.presence-caret`: thin caret to mark the edit insertion point. Uses `--presence-color`.

**How to render**
* Place overlays as absolutely positioned elements above cells.
* Keep table base styles intact. Do not replace `bg-surface-table*`.
* Make the cell (or table root) `relative`; insert overlay children with `.presence-overlay`.
* Prefer `pointer-events-none` and a high z-index so overlays never block UI.

**Minimal example**

```html
<td class="relative bg-surface-table text-fg-table">
  Turbine Alignment Review
  <div class="presence-overlay presence-range"
       style="--presence-color: var(--brand-blue); --presence-fill-alpha: .14;"></div>
  <div class="presence-overlay presence-outline"
       style="--presence-outline: var(--brand-blue);"></div>
  <div class="presence-overlay presence-caret"
       style="--presence-color: var(--brand-blue); left: 6px;"></div>
</td>
```

Use different token values per user to stack multiple overlays.


## Usage Checklist
- Import `@integrapcs/design-tokens/tokens.css` (or the frontend re-export) before adding UI.
- Stick to allowed utilities (`bg-brand-500`, `bg-surface-table*`, `text-fg-*`, spacing `1–6`, typography `text-sm|base|lg`, `rounded-2`, `shadow-1`).
- Avoid arbitrary Tailwind values; rely on tokens or extend the token file when new values are required.
- When adjusting tokens, regenerate Storybook/build outputs so Tailwind picks up the changes.
