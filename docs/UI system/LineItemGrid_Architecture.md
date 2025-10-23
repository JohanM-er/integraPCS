# LineItemGrid Component Architecture

## Component Overview

**LineItemGrid** is a pure table component for displaying construction line items with built-in scroll container support and intelligent sticky header behavior.

**File Location:** `frontend/src/components/LineItemGrid.tsx`

**Component Type:** Presentation Component (Pure Table)

**Ref Target:** `HTMLTableElement`

---

## Component Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ LineItemGrid (forwardRef<HTMLTableElement>)                     │
│ - Computes derivedStickyHeader                                  │
│ - Builds wrapperStyle from container props                      │
│ - Formats currency using Intl.NumberFormat                      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ├──> Renders
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ <div> (Scroll Container Wrapper)                                │
│ - className: 'overflow-auto' + containerClassName               │
│ - style: wrapperStyle (height/maxHeight)                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            └──> Contains
                                 │
                                 ▼
                ┌────────────────────────────────────────────┐
                │ <table> (ref forwarded)                    │
                │ - className: tableVariants + w-full        │
                │ - aria-label: ariaLabel || 'Line items...' │
                └────────────────────────────────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
                ▼                                 ▼
    ┌───────────────────────┐       ┌────────────────────────┐
    │ <thead>               │       │ <tbody>                │
    │ - sticky top-0        │       │ - Maps rows array      │
    │   (if derived sticky) │       └────────────────────────┘
    └───────────────────────┘                   │
                │                               │
                ▼                               ▼
    ┌───────────────────────┐       ┌────────────────────────┐
    │ <tr>                  │       │ <tr> (for each row)    │
    │ - 7 columns           │       │ - key: row.id          │
    └───────────────────────┘       │ - onClick handler      │
                │                   │ - cursor-pointer       │
                ▼                   └────────────────────────┘
    ┌───────────────────────┐                   │
    │ <th> × 7              │                   ▼
    │ ID, Type, Task,       │       ┌────────────────────────┐
    │ Quantity, Unit,       │       │ <td> × 7 (per row)     │
    │ Price, Total          │       │ ID, Type, Task,        │
    │ - scope="col"         │       │ Quantity, Unit,        │
    │ - semantic alignment  │       │ Price, Total           │
    └───────────────────────┘       └────────────────────────┘
                                                │
                                                │ (Task column)
                                                ▼
                                    ┌────────────────────────┐
                                    │ <button> (if onClick)  │
                                    │ - Interactive task link│
                                    │ - Focus ring styles    │
                                    │ - Click handler        │
                                    └────────────────────────┘
```

---

## Data Flow Diagram

### Props Flow (Top-Down)

```
┌─────────────────────────────────────────────────────────────────┐
│ Parent Component (Consumer)                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Passes Props
                            ▼
        ┌─────────────────────────────────────────────┐
        │         LineItemGrid Props                  │
        ├─────────────────────────────────────────────┤
        │ DATA PROPS:                                 │
        │   • rows: LineItemRow[]                     │
        │                                             │
        │ STYLING PROPS:                              │
        │   • density: 'compact'|'normal'|'spacious'  │
        │   • borders: 'row'|'all'|'none'             │
        │   • headerTone: 'default'|'none'            │
        │   • striped: boolean                        │
        │   • hoverable: boolean                      │
        │   • selectable: boolean                     │
        │   • className: string                       │
        │                                             │
        │ SCROLL CONTAINER PROPS:                     │
        │   • containerHeight: string                 │
        │   • containerMaxHeight: string              │
        │   • containerClassName: string              │
        │   • containerStyle: CSSProperties           │
        │                                             │
        │ STICKY HEADER:                              │
        │   • stickyHeader: boolean (optional)        │
        │                                             │
        │ INTERACTION:                                │
        │   • onRowClick: (row) => void               │
        │                                             │
        │ I18N:                                       │
        │   • locale: string (default: 'en-US')       │
        │   • currency: string (default: 'USD')       │
        │                                             │
        │ ACCESSIBILITY:                              │
        │   • ariaLabel: string                       │
        │   • ref: Ref<HTMLTableElement>              │
        └─────────────────────────────────────────────┘
                            │
            ┌───────────────┴────────────────────┐
            │                                    │
            ▼                                    ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│ Internal Computation     │      │ Helper Functions         │
├──────────────────────────┤      ├──────────────────────────┤
│ derivedStickyHeader =    │      │ formatCurrency()         │
│   typeof stickyHeader === │      │   • Uses Intl.Number     │
│   'boolean' ?            │      │     Format API           │
│     stickyHeader :       │      │   • Params: value,       │
│     Boolean(             │      │     locale, currency     │
│       containerHeight || │      │   • Returns formatted    │
│       containerMaxHeight │      │     string               │
│     )                    │      │                          │
│                          │      │ getTotal()               │
│ wrapperStyle = {         │      │   • row.total ||         │
│   ...containerStyle,     │      │     (quantity * price)   │
│   ...(height props)      │      │   • Returns number       │
│ }                        │      │                          │
└──────────────────────────┘      └──────────────────────────┘
            │                                    │
            └─────────────┬──────────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────────┐
        │         Render Output                   │
        ├─────────────────────────────────────────┤
        │ <div wrapper>                           │
        │   className = cx(                       │
        │     'overflow-auto',                    │
        │     containerClassName                  │
        │   )                                     │
        │   style = wrapperStyle                  │
        │                                         │
        │   <table ref={ref}>                     │
        │     className = cx(                     │
        │       'w-full',                         │
        │       tableVariants({...}),             │
        │       className                         │
        │     )                                   │
        │                                         │
        │     <thead>                             │
        │       className = cx(                   │
        │         derivedStickyHeader &&          │
        │           'sticky top-0',               │
        │         ...                             │
        │       )                                 │
        │                                         │
        │       <tr>                              │
        │         <th>ID</th>                     │
        │         <th>Type</th>                   │
        │         <th>Task</th>                   │
        │         <th>Quantity</th>               │
        │         <th>Unit</th>                   │
        │         <th>Price</th>                  │
        │         <th>Total</th>                  │
        │       </tr>                             │
        │     </thead>                            │
        │                                         │
        │     <tbody>                             │
        │       {rows.map(r => (                  │
        │         <tr key={r.id}                  │
        │             onClick={() =>              │
        │               onRowClick?.(r)           │
        │             }>                          │
        │           <td>{r.id}</td>               │
        │           <td>{r.type}</td>             │
        │           <td>                          │
        │             {onRowClick ? (             │
        │               <button                   │
        │                 onClick={...}>          │
        │                 {r.task}                │
        │               </button>                 │
        │             ) : r.task}                 │
        │           </td>                         │
        │           <td>{r.quantity}</td>         │
        │           <td>{r.unit}</td>             │
        │           <td>                          │
        │             {formatCurrency(            │
        │               r.price,                  │
        │               {locale, currency}        │
        │             )}                          │
        │           </td>                         │
        │           <td>                          │
        │             {formatCurrency(            │
        │               getTotal(r),              │
        │               {locale, currency}        │
        │             )}                          │
        │           </td>                         │
        │         </tr>                           │
        │       ))}                               │
        │     </tbody>                            │
        │   </table>                              │
        │ </div>                                  │
        └─────────────────────────────────────────┘
```

---

## Event Flow (Bottom-Up)

```
┌─────────────────────────────────────────────────────────────────┐
│ User Interaction                                                │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
    ┌───────────────┐           ┌──────────────────────┐
    │ Click on      │           │ Click on Task button │
    │ Table Row     │           │ (when onRowClick set)│
    └───────────────┘           └──────────────────────┘
            │                               │
            │                               │ e.stopPropagation()
            │                               │ prevents row click
            ▼                               ▼
    ┌───────────────┐           ┌──────────────────────┐
    │ <tr onClick>  │           │ <button onClick>     │
    │ handler       │           │ handler              │
    └───────────────┘           └──────────────────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │ onRowClick?.(row)     │
                │ - Invokes callback    │
                │ - Passes full row data│
                └───────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │ Parent Component Handler      │
            │ - Receives row data           │
            │ - Performs action (navigate,  │
            │   open modal, update state)   │
            └───────────────────────────────┘
```

---

## State Management

### Component State: **NONE** (Stateless Pure Component)

LineItemGrid is a **controlled component** with no internal state:

```
┌─────────────────────────────────────────────────────────────────┐
│ State Location: Parent Component (Consumer)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ const [rows, setRows] = useState<LineItemRow[]>([...]);        │
│ const [selectedRow, setSelectedRow] = useState<string|null>(); │
│                                                                 │
│ <LineItemGrid                                                  │
│   rows={rows}                 ◄─── Data from parent state      │
│   onRowClick={(row) => {      ◄─── Event handler               │
│     setSelectedRow(row.id);                                    │
│     navigate(`/items/${row.id}`);                              │
│   }}                                                           │
│ />                                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Why Stateless?**
- ✅ Easier testing (pure function behavior)
- ✅ Predictable rendering (props in → UI out)
- ✅ Reusability (no hidden state coupling)
- ✅ Performance (React can optimize better)

---

## Derived Values Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Props Input                                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌──────────────────────────┐
│ Sticky Header Logic   │       │ Wrapper Style Computation│
├───────────────────────┤       ├──────────────────────────┤
│ INPUT:                │       │ INPUT:                   │
│  - stickyHeader       │       │  - containerStyle        │
│  - containerHeight    │       │  - containerHeight       │
│  - containerMaxHeight │       │  - containerMaxHeight    │
│                       │       │                          │
│ LOGIC:                │       │ LOGIC:                   │
│  if (typeof           │       │  wrapperStyle = {        │
│    stickyHeader ===   │       │    ...containerStyle,    │
│    'boolean')         │       │    ...(containerHeight   │
│    return stickyHeader│       │      ? { height: ... }   │
│  else                 │       │      : {}),              │
│    return Boolean(    │       │    ...(containerMaxHeight│
│      containerHeight  │       │      ? { maxHeight: ...} │
│      ||               │       │      : {})               │
│      containerMaxHeight│      │  }                       │
│    )                  │       │                          │
│                       │       │                          │
│ OUTPUT:               │       │ OUTPUT:                  │
│  derivedStickyHeader  │       │  wrapperStyle object     │
│  (boolean)            │       │  (CSSProperties)         │
└───────────────────────┘       └──────────────────────────┘
            │                               │
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌──────────────────────────┐
│ Applied to <thead>    │       │ Applied to wrapper <div> │
│ className             │       │ style attribute          │
└───────────────────────┘       └──────────────────────────┘
```

---

## Data Transformation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Row Data Input                                                  │
│ rows: LineItemRow[]                                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │ rows.map((r) => <tr>...</tr>) │
            │ - Iterate over each row       │
            │ - Generate table row JSX      │
            └───────────────────────────────┘
                            │
            ┌───────────────┴───────────────────────┐
            │                                       │
            ▼                                       ▼
┌──────────────────────┐              ┌──────────────────────────┐
│ Direct Display       │              │ Computed/Formatted       │
├──────────────────────┤              ├──────────────────────────┤
│ • r.id               │              │ PRICE COLUMN:            │
│ • r.type             │              │   formatCurrency(        │
│ • r.task (raw text)  │              │     r.price,             │
│ • r.quantity         │              │     { locale, currency } │
│ • r.unit             │              │   )                      │
│                      │              │                          │
│ (No transformation)  │              │ TOTAL COLUMN:            │
│                      │              │   formatCurrency(        │
│                      │              │     getTotal(r),         │
│                      │              │     { locale, currency } │
│                      │              │   )                      │
│                      │              │                          │
│                      │              │ where getTotal(r) =      │
│                      │              │   r.total ?? (r.quantity │
│                      │              │     * r.price)           │
└──────────────────────┘              └──────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │ Rendered Table Cells          │
            │ <td>{formatted value}</td>    │
            └───────────────────────────────┘
```

---

## Auto-Sticky Logic Truth Table

```
┌───────────────┬──────────────────┬──────────────────┬─────────────────┐
│ stickyHeader  │ containerHeight  │ containerMaxH    │ Sticky Applied? │
│ (prop)        │ (prop)           │ (prop)           │ (derived)       │
├───────────────┼──────────────────┼──────────────────┼─────────────────┤
│ true          │ any              │ any              │ ✅ YES (true)   │
│ false         │ any              │ any              │ ❌ NO (false)   │
│ undefined     │ '24rem'          │ undefined        │ ✅ YES (auto)   │
│ undefined     │ undefined        │ '100vh'          │ ✅ YES (auto)   │
│ undefined     │ '24rem'          │ '100vh'          │ ✅ YES (auto)   │
│ undefined     │ undefined        │ undefined        │ ❌ NO (auto)    │
└───────────────┴──────────────────┴──────────────────┴─────────────────┘

LOGIC:
  derivedStickyHeader =
    typeof stickyHeader === 'boolean'
      ? stickyHeader                          // Explicit control
      : Boolean(containerHeight || containerMaxHeight) // Auto-enable
```

---

## Ref Forwarding Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Parent Component                                                │
│                                                                 │
│ const tableRef = useRef<HTMLTableElement>(null);                │
│                                                                 │
│ <LineItemGrid                                                  │
│   ref={tableRef}  ◄────────────────────────────────────┐       │
│   rows={rows}                                          │       │
│ />                                                     │       │
│                                                        │       │
│ // Can access table DOM:                              │       │
│ tableRef.current?.scrollIntoView();                   │       │
│ tableRef.current?.querySelector('thead');             │       │
└─────────────────────────────────────────────────────────────────┘
                                                         │
                                                         │ ref passed
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ LineItemGrid (forwardRef wrapper)                               │
│                                                                 │
│ export const LineItemGrid = forwardRef<                        │
│   HTMLTableElement,  ◄─── Type of ref target                   │
│   LineItemGridProps                                            │
│ >((props, ref) => {  ◄─── Receives ref as second parameter     │
│   ...                                                          │
│   return (                                                     │
│     <div>                                                      │
│       <table ref={ref}> ◄─── Forwards to table element        │
│         ...                                                    │
│       </table>                                                 │
│     </div>                                                     │
│   );                                                           │
│ });                                                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ ref attached
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ <table> DOM Element (HTMLTableElement)                         │
│                                                                 │
│ Parent can now access:                                         │
│  • tableRef.current.rows                                       │
│  • tableRef.current.tHead                                      │
│  • tableRef.current.tBodies                                    │
│  • All standard HTMLTableElement methods/properties            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Styling Flow (CVA + Tailwind)

```
┌─────────────────────────────────────────────────────────────────┐
│ Styling Inputs                                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌──────────────────────┐        ┌──────────────────────────┐
│ Table Variant Props  │        │ Container/Utility Classes│
├──────────────────────┤        ├──────────────────────────┤
│ • density            │        │ WRAPPER DIV:             │
│ • borders            │        │  • 'overflow-auto'       │
│ • headerTone         │        │  • containerClassName    │
│ • striped            │        │                          │
│ • hoverable          │        │ TABLE:                   │
│ • selectable         │        │  • 'w-full'              │
│                      │        │  • className (from props)│
│ Passed to:           │        │                          │
│ tableVariants({...}) │        │ THEAD (conditional):     │
└──────────────────────┘        │  • 'sticky top-0'        │
            │                   │    (if derivedSticky)    │
            │                   │  • 'bg-surface-table-    │
            ▼                   │    header' (if no tone)  │
┌──────────────────────┐        │                          │
│ CVA Function Call    │        │ TH/TD (semantic):        │
│ (cva.ts)             │        │  • 'px-3'                │
│                      │        │  • 'text-left'           │
│ Returns computed     │        │  • 'text-right'          │
│ class string based   │        │  • 'font-semibold'       │
│ on variant combo     │        │  • 'font-medium'         │
└──────────────────────┘        │  • 'rounded-2'           │
            │                   │  • 'focus-visible:...'   │
            │                   │  • 'cursor-pointer'      │
            └───────────────────┴──────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────────┐
            │ cx() Utility (tailwind-merge) │
            │ - Merges class strings        │
            │ - Resolves conflicts          │
            │ - Returns final className     │
            └───────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Applied to DOM Elements                                         │
│                                                                 │
│ <div className="overflow-auto">                                 │
│   <table className="w-full bg-surface-table text-fg-table ...">│
│     <thead className="sticky top-0 bg-surface-table-header">   │
│       <th className="px-3 text-left font-semibold">...</th>     │
│     </thead>                                                    │
│     <tbody>                                                     │
│       <td className="px-3 text-right">...</td>                  │
│     </tbody>                                                    │
│   </table>                                                      │
│ </div>                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Usage Patterns

### Pattern 1: Basic Auto-Height Table

```typescript
<LineItemGrid
  rows={lineItems}
  density="normal"
/>

// Behavior:
// - No scroll container height set
// - Table grows with content
// - No sticky header (derivedStickyHeader = false)
```

### Pattern 2: Scrollable with Auto-Sticky

```typescript
<LineItemGrid
  rows={lineItems}
  containerHeight="24rem"
  density="compact"
/>

// Behavior:
// - Fixed height scroll container (24rem)
// - Sticky header auto-enabled (derivedStickyHeader = true)
// - Compact row spacing
```

### Pattern 3: Explicit Sticky Control

```typescript
<LineItemGrid
  rows={lineItems}
  containerHeight="500px"
  stickyHeader={false}  // Explicitly disable
  density="spacious"
/>

// Behavior:
// - Fixed height scroll container
// - Sticky header disabled despite height
// - Spacious row spacing
```

### Pattern 4: Interactive with Row Click

```typescript
const handleRowClick = (row: LineItemRow) => {
  navigate(`/items/${row.id}`);
};

<LineItemGrid
  rows={lineItems}
  onRowClick={handleRowClick}
  containerMaxHeight="100vh"
/>

// Behavior:
// - Row click navigation
// - Task column renders as <button>
// - Responsive max height
// - Auto-sticky enabled
```

### Pattern 5: Internationalized

```typescript
<LineItemGrid
  rows={lineItems}
  locale="de-DE"
  currency="EUR"
  containerHeight="400px"
/>

// Behavior:
// - Prices formatted as €1.234,56
// - German locale formatting
// - Fixed scroll height with sticky header
```

---

## Performance Characteristics

### Render Optimization

```
┌─────────────────────────────────────────────────────────────────┐
│ Component Re-renders When:                                      │
├─────────────────────────────────────────────────────────────────┤
│ ✅ rows array changes (identity or content)                     │
│ ✅ Any prop value changes                                       │
│ ✅ Parent component re-renders (no React.memo)                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Component Does NOT Re-render When:                              │
├─────────────────────────────────────────────────────────────────┤
│ ✅ User scrolls (DOM-only operation)                            │
│ ✅ Row hover states (CSS-only)                                  │
│ ✅ Focus states (CSS-only)                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Performance Notes

- **No virtualization**: Renders all rows. For large datasets (>1000 rows), consider react-window or react-virtualized.
- **Memoization opportunity**: Wrap in `React.memo()` if parent re-renders frequently.
- **formatCurrency** called per cell per render: Consider memoizing formatted values for very large tables.
- **Sticky positioning**: Hardware-accelerated, minimal performance impact.

---

## Accessibility Features

```
┌─────────────────────────────────────────────────────────────────┐
│ ARIA Attributes                                                 │
├─────────────────────────────────────────────────────────────────┤
│ <table aria-label="...">                                        │
│   • Provides table description for screen readers              │
│   • Falls back to "Line items table" if not specified          │
│                                                                 │
│ <th scope="col">                                                │
│   • Defines column headers                                     │
│   • Associates data cells with headers                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Keyboard Navigation                                             │
├─────────────────────────────────────────────────────────────────┤
│ Task <button> (when onRowClick set):                            │
│   • Tab: Focus the button                                      │
│   • Enter/Space: Trigger click                                 │
│   • Visible focus ring (focus-visible:ring-2)                  │
│                                                                 │
│ Table scrolling:                                                │
│   • Tab: Move through interactive elements                     │
│   • Arrow keys: Scroll container (browser default)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Semantic HTML                                                   │
├─────────────────────────────────────────────────────────────────┤
│ • <table>: Proper data table structure                          │
│ • <thead>, <tbody>: Logical sections                            │
│ • <th>: Header cells with scope                                 │
│ • <td>: Data cells                                              │
│ • <button>: Interactive tasks (when clickable)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design System Compliance

✅ **No Arbitrary Values**: All spacing, colors, and styles use design tokens
✅ **CVA Variants**: Table styling via class-variance-authority
✅ **Tailwind v4 Tokens**: Uses @theme tokens from tokens.css
✅ **ESLint Enforced**: no-restricted-syntax rule for inline styles (with exceptions documented)
✅ **Consistent Spacing**: Uses spacing scale (px-3 from token system)
✅ **Semantic Colors**: bg-surface-table, text-fg-table from design tokens

---

## Testing Considerations

### Unit Tests (Vitest + Testing Library)

```typescript
// Example test structure
describe('LineItemGrid', () => {
  it('renders all column headers', () => {
    render(<LineItemGrid rows={mockRows} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    // ... all 7 columns
  });

  it('formats currency with correct locale', () => {
    render(<LineItemGrid rows={mockRows} locale="de-DE" currency="EUR" />);
    expect(screen.getByText(/€/)).toBeInTheDocument();
  });

  it('calls onRowClick when row is clicked', async () => {
    const handleClick = vi.fn();
    render(<LineItemGrid rows={mockRows} onRowClick={handleClick} />);

    await userEvent.click(screen.getByText('DC Cable 4mm'));
    expect(handleClick).toHaveBeenCalledWith(mockRows[0]);
  });

  it('applies sticky header when containerHeight is set', () => {
    render(<LineItemGrid rows={mockRows} containerHeight="24rem" />);
    const thead = screen.getByRole('table').querySelector('thead');
    expect(thead).toHaveClass('sticky', 'top-0');
  });
});
```

---

## File Dependencies

```
LineItemGrid.tsx
├── Imports
│   ├── react (forwardRef)
│   ├── @/lib/cx (tailwind-merge wrapper)
│   └── @/lib/cva (tableVariants, TableVariants type)
│
├── Exports
│   ├── LineItemRow (interface)
│   ├── LineItemGridProps (interface)
│   └── LineItemGrid (component)
│
└── Internal Functions
    ├── formatCurrency() - Intl.NumberFormat wrapper
    └── getTotal() - row.total ?? (quantity * price)

LineItemGrid.stories.tsx
├── Imports
│   ├── ./LineItemGrid (LineItemGrid, LineItemRow)
│   └── @storybook/react (Meta, StoryObj)
│
├── Mock Data
│   └── sampleRows (6 line items)
│
└── Stories
    ├── Default
    ├── Compact
    ├── Spacious
    ├── WithStickyHeader (uses containerHeight)
    ├── WithRowClick
    └── EuroCurrency
```

---

## Migration Notes (from Original Implementation)

### Removed Features
- ❌ Panel wrapper (panelVariants)
- ❌ Toolbar header with title
- ❌ Footer with metadata (rowsCount, columnsSelected, lastSyncText)
- ❌ GridMetadata interface
- ❌ title, metadata, showFooter props

### Added Features
- ✅ Internal scroll container configuration
- ✅ Auto-sticky header logic
- ✅ containerHeight, containerMaxHeight, containerClassName, containerStyle props
- ✅ Ref forwarding to HTMLTableElement (was HTMLDivElement)

### Breaking Changes
- **Ref type changed**: HTMLDivElement → HTMLTableElement
- **Props removed**: title, metadata, showFooter
- **className target changed**: Now applies to <table>, not outer wrapper
- **No footer chrome**: Consumers must add their own if needed

---

## Summary

**LineItemGrid** is a well-architected, pure, composable table component that:

1. **Renders efficiently** with no internal state
2. **Handles scrolling** via configurable container props
3. **Auto-enables sticky headers** when scroll constraints are present
4. **Formats internationalized currency** using Intl API
5. **Forwards refs** to the underlying table element
6. **Follows design system** with no arbitrary values
7. **Maintains accessibility** with semantic HTML and ARIA
8. **Remains testable** as a pure function of props

It demonstrates React best practices: controlled components, ref forwarding, derived state, and separation of concerns.
