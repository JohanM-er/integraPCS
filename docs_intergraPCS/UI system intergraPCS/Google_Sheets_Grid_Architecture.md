# Google Sheets-Style Editable Grid Architecture

## Overview

This document explains how Google Sheets implements its frontend grid component and provides a blueprint for building a similar editable grid system for line items in React.

---

## Table of Contents

1. [Core Architecture](#core-architecture)
2. [Interaction Modes](#interaction-modes)
3. [Cell State Machine](#cell-state-machine)
4. [Keyboard Navigation System](#keyboard-navigation-system)
5. [Data Type System](#data-type-system)
6. [Rendering Strategy](#rendering-strategy)
7. [Performance Optimizations](#performance-optimizations)
8. [React Implementation Patterns](#react-implementation-patterns)
9. [Recommended Libraries](#recommended-libraries)
10. [Line Item Grid Use Case](#line-item-grid-use-case)

---

## Core Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Google Sheets Grid Component Architecture                      │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴────────────────┐
            │                                │
            ▼                                ▼
┌──────────────────────┐        ┌──────────────────────────┐
│ Virtual Scrolling    │        │ Cell State Management    │
│ Canvas Layer         │        │ - View Mode              │
│                      │        │ - Edit Mode              │
│ Only renders visible │        │ - Selection State        │
│ cells (~50-100 rows) │        │ - Focus State            │
└──────────────────────┘        └──────────────────────────┘
            │                                │
            └────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Dual-Layer Rendering System        │
        ├────────────────────────────────────┤
        │ Layer 1: Canvas (Read-Only View)   │
        │ - Fast rendering of cell values    │
        │ - Grid lines, backgrounds          │
        │ - Selection highlights             │
        │                                    │
        │ Layer 2: HTML Overlay (Edit Mode)  │
        │ - Input element positioned over    │
        │   active cell                      │
        │ - Rich text editor for formulas    │
        │ - Auto-complete dropdowns          │
        └────────────────────────────────────┘
```

### Key Architectural Principles

1. **Separation of Concerns**
   - View layer (display formatted values)
   - Edit layer (modify raw values)
   - Data layer (store and validate)

2. **Virtual Scrolling**
   - Only render visible cells (~50-100 rows at a time)
   - Recycle DOM elements as user scrolls
   - Dramatically improves performance for large datasets

3. **Dual-Layer Rendering**
   - Canvas for static grid rendering (fast)
   - HTML overlay for active editing (flexible)

4. **State Machine**
   - Clear transitions between modes
   - Predictable behavior
   - Easy to reason about

---

## Interaction Modes

Google Sheets operates in **three distinct modes**, each with different keyboard behavior:

### Mode 1: Navigation Mode (Default)

```
┌─────────────────────────────────────────────────────────────────┐
│ NAVIGATION MODE - Moving Between Cells                         │
├─────────────────────────────────────────────────────────────────┤
│ Arrow Keys (↑ ↓ ← →)  │ Move selection to adjacent cell        │
│ Tab                   │ Move selection right                    │
│ Shift + Tab           │ Move selection left                     │
│ Enter                 │ Move selection down                     │
│ Shift + Enter         │ Move selection up                       │
│ Home                  │ Move to first column in row             │
│ Ctrl/Cmd + Home       │ Move to cell A1                         │
│ End                   │ Move to last column with data           │
│ Ctrl/Cmd + End        │ Move to last cell with data             │
│ Page Up/Down          │ Scroll one page up/down                 │
│ Click                 │ Select cell                             │
│ Shift + Click         │ Extend selection to clicked cell        │
│ Ctrl/Cmd + Click      │ Add cell to multi-selection             │
└─────────────────────────────────────────────────────────────────┘

Display: Cell shows FORMATTED value (e.g., "$1,234.56" not "1234.56")
```

### Mode 2: Edit Mode (Active Editing)

```
┌─────────────────────────────────────────────────────────────────┐
│ EDIT MODE - Editing Cell Content                               │
├─────────────────────────────────────────────────────────────────┤
│ ENTER EDIT MODE:                                                │
│  • Double-click cell                                            │
│  • Press F2                                                     │
│  • Start typing (any printable character)                       │
│  • Click in formula bar                                         │
│                                                                 │
│ WHILE IN EDIT MODE:                                             │
│  Arrow Keys (↑ ↓ ← →) │ Move cursor INSIDE cell (not between)  │
│  Home                 │ Move cursor to start of text            │
│  End                  │ Move cursor to end of text              │
│  Backspace/Delete     │ Delete characters                       │
│  Ctrl/Cmd + A         │ Select all text in cell                 │
│  Escape               │ Cancel edit, revert to original         │
│  Enter                │ Commit edit, move down                  │
│  Tab                  │ Commit edit, move right                 │
│  Shift + Enter        │ Commit edit, move up                    │
│  Shift + Tab          │ Commit edit, move left                  │
└─────────────────────────────────────────────────────────────────┘

Display: Cell shows RAW value/formula (e.g., "=A1*B1" not calculated result)
```

### Mode 3: Selection Mode (Range Selection)

```
┌─────────────────────────────────────────────────────────────────┐
│ SELECTION MODE - Selecting Multiple Cells                      │
├─────────────────────────────────────────────────────────────────┤
│ Shift + Arrow Keys    │ Extend selection in direction           │
│ Click + Drag          │ Select rectangular range                │
│ Click Column Header   │ Select entire column                    │
│ Click Row Header      │ Select entire row                       │
│ Ctrl/Cmd + A          │ Select all cells                        │
│ Shift + Click         │ Extend selection to clicked cell        │
│ Ctrl/Cmd + Shift +    │ Select from current to edge of data     │
│   Arrow               │ region in that direction                │
└─────────────────────────────────────────────────────────────────┘

Display: Multiple cells highlighted with blue background
```

---

## Cell State Machine

Each cell progresses through distinct states based on user interaction:

```
┌─────────────────────────────────────────────────────────────────┐
│ Cell State Transitions                                          │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   IDLE       │ ◄──────────────────────┐
    │              │                        │
    │ • No border  │                        │
    │ • Show value │                        │
    │ • Not focused│                        │
    └──────────────┘                        │
           │                                │
           │ Click / Arrow Key              │
           ▼                                │
    ┌──────────────┐                        │
    │  SELECTED    │                        │
    │              │                        │
    │ • Blue border│                        │
    │ • Show value │                        │
    │ • Focused    │                        │
    └──────────────┘                        │
           │                                │
           │ Double-click /                 │
           │ F2 / Start typing              │
           ▼                                │
    ┌──────────────┐                        │
    │  EDITING     │                        │
    │              │                        │
    │ • Blue fill  │                        │
    │ • Input active│                       │
    │ • Show raw   │                        │
    │   value      │                        │
    └──────────────┘                        │
           │                                │
           │ Enter / Tab /                  │
           │ Click outside /                │
           │ Blur                           │
           └────────────────────────────────┘
```

### State Definitions

| State      | Visual                  | Behavior                               | Data Shown      |
|------------|-------------------------|----------------------------------------|-----------------|
| **IDLE**   | No border               | Not interactive                        | Formatted value |
| **SELECTED** | Blue border (2px)     | Can navigate, copy, enter edit mode    | Formatted value |
| **EDITING** | Blue background fill   | Keyboard input active, cursor visible  | Raw value       |

---

## Keyboard Navigation System

Google Sheets uses a **two-phase keyboard event handling** system:

### Phase 1: Navigation Mode (No Cell Being Edited)

```typescript
// Grid-level keyboard handler
function handleGridKeyDown(event: KeyboardEvent) {
  // Prevent default browser behavior for navigation keys
  const navigationKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                          'Tab', 'Enter', 'Home', 'End', 'PageUp', 'PageDown'];

  if (navigationKeys.includes(event.key)) {
    event.preventDefault();
  }

  switch (event.key) {
    case 'ArrowRight':
      moveSelection('right');
      break;

    case 'ArrowLeft':
      moveSelection('left');
      break;

    case 'ArrowDown':
      moveSelection('down');
      break;

    case 'ArrowUp':
      moveSelection('up');
      break;

    case 'Enter':
      if (event.shiftKey) {
        moveSelection('up');
      } else {
        moveSelection('down');
      }
      break;

    case 'Tab':
      if (event.shiftKey) {
        moveSelection('left');
      } else {
        moveSelection('right');
      }
      break;

    case 'F2':
      enterEditMode();
      break;

    case 'Delete':
    case 'Backspace':
      clearSelectedCells();
      break;

    default:
      // If user types a printable character, enter edit mode
      if (isPrintableCharacter(event.key) && !event.ctrlKey && !event.metaKey) {
        enterEditMode();
        // Let the character be typed into the input
      }
  }
}

function isPrintableCharacter(key: string): boolean {
  return key.length === 1;
}
```

### Phase 2: Edit Mode (Cell Being Edited)

```typescript
// Cell editor keyboard handler
function handleEditorKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.preventDefault();
      exitEditMode({ commit: false }); // Revert changes
      break;

    case 'Enter':
      if (!event.shiftKey) {
        event.preventDefault();
        commitAndMove('down');
      }
      break;

    case 'Tab':
      event.preventDefault();
      if (event.shiftKey) {
        commitAndMove('left');
      } else {
        commitAndMove('right');
      }
      break;

    // Arrow keys are NOT prevented - they move cursor within input
    // Home, End, etc. also move cursor within input
  }
}

function commitAndMove(direction: 'up' | 'down' | 'left' | 'right') {
  const value = getCurrentInputValue();
  const parsedValue = parseValueByDataType(value, currentCell.dataType);

  if (isValid(parsedValue)) {
    updateCellValue(currentCell, parsedValue);
    exitEditMode({ commit: true });
    moveSelection(direction);
  } else {
    showValidationError();
  }
}
```

---

## Data Type System

### Column Schema Definition

For a configurable grid where each column has a specific data type:

```typescript
interface ColumnDefinition {
  id: string;                    // Unique identifier (e.g., 'price')
  name: string;                  // Display name (e.g., 'Price')
  dataType: DataType;            // Data type for the column
  width?: number;                // Column width in pixels
  editable?: boolean;            // Can cells be edited? (default: true)
  required?: boolean;            // Is value required? (default: false)
  validator?: (value: any) => ValidationResult;
  formatter?: (value: any) => string;
  parser?: (input: string) => any;
  defaultValue?: any;
}

type DataType =
  | 'string'
  | 'number'
  | 'integer'
  | 'float'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'time'
  | 'boolean'
  | 'select'      // Dropdown with predefined options
  | 'multiselect' // Multiple selection
  | 'formula'     // Computed value
  | 'url'
  | 'email';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}
```

### Data Type Implementations

```typescript
// Example: String Type
const stringColumn: ColumnDefinition = {
  id: 'task',
  name: 'Task',
  dataType: 'string',
  validator: (value) => ({
    isValid: typeof value === 'string' && value.length > 0,
    error: 'Task name is required'
  }),
  formatter: (value) => String(value).trim(),
  parser: (input) => input.trim()
};

// Example: Number Type
const numberColumn: ColumnDefinition = {
  id: 'quantity',
  name: 'Quantity',
  dataType: 'number',
  validator: (value) => ({
    isValid: !isNaN(value) && value >= 0,
    error: 'Quantity must be a non-negative number'
  }),
  formatter: (value) => value.toFixed(2),
  parser: (input) => parseFloat(input)
};

// Example: Currency Type
const currencyColumn: ColumnDefinition = {
  id: 'price',
  name: 'Price',
  dataType: 'currency',
  validator: (value) => ({
    isValid: !isNaN(value) && value >= 0,
    error: 'Price must be a non-negative number'
  }),
  formatter: (value) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value),
  parser: (input) => {
    // Remove currency symbols and commas
    const cleaned = input.replace(/[$,]/g, '');
    return parseFloat(cleaned);
  }
};

// Example: Date Type
const dateColumn: ColumnDefinition = {
  id: 'dueDate',
  name: 'Due Date',
  dataType: 'date',
  validator: (value) => ({
    isValid: value instanceof Date && !isNaN(value.getTime()),
    error: 'Invalid date format'
  }),
  formatter: (value) => value.toLocaleDateString('en-US'),
  parser: (input) => new Date(input)
};

// Example: Select Type
const selectColumn: ColumnDefinition = {
  id: 'type',
  name: 'Type',
  dataType: 'select',
  options: ['Material', 'Labor', 'Equipment'],
  validator: (value) => ({
    isValid: ['Material', 'Labor', 'Equipment'].includes(value),
    error: 'Invalid type selection'
  }),
  formatter: (value) => String(value),
  parser: (input) => input
};

// Example: Formula Type (Computed)
const formulaColumn: ColumnDefinition = {
  id: 'total',
  name: 'Total',
  dataType: 'formula',
  editable: false,
  formula: (row: Record<string, any>) => {
    return row.quantity * row.price;
  },
  formatter: (value) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
};
```

---

## Rendering Strategy

### Dual-Layer Approach

Google Sheets uses two rendering layers for optimal performance:

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 1: Canvas (Background)                                   │
├─────────────────────────────────────────────────────────────────┤
│ • Draws grid lines                                              │
│ • Draws cell backgrounds (alternating rows, selection)          │
│ • Renders static text (formatted values)                        │
│ • Very fast - GPU accelerated                                   │
│ • Updated only when scrolling or data changes                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Layer 2: HTML Overlay (Foreground)                             │
├─────────────────────────────────────────────────────────────────┤
│ • Positioned absolutely over active cell                        │
│ • Contains <input> or <textarea> element                        │
│ • Only rendered for the cell being edited                       │
│ • Handles text selection, cursor, IME input                     │
│ • Can contain rich UI (date pickers, dropdowns)                 │
└─────────────────────────────────────────────────────────────────┘
```

### React Virtual Scrolling Implementation

```typescript
import { FixedSizeGrid } from 'react-window';

interface GridData {
  rows: any[][];
  columns: ColumnDefinition[];
  editingCell: { row: number; col: number } | null;
  selectedCell: { row: number; col: number } | null;
}

const VirtualizedGrid: React.FC<{ data: GridData }> = ({ data }) => {
  return (
    <FixedSizeGrid
      columnCount={data.columns.length}
      columnWidth={120}
      height={600}
      rowCount={data.rows.length}
      rowHeight={35}
      width={800}
    >
      {({ columnIndex, rowIndex, style }) => {
        const cell = data.rows[rowIndex][columnIndex];
        const isEditing =
          data.editingCell?.row === rowIndex &&
          data.editingCell?.col === columnIndex;
        const isSelected =
          data.selectedCell?.row === rowIndex &&
          data.selectedCell?.col === columnIndex;

        return (
          <div style={style}>
            {isEditing ? (
              <CellEditor
                value={cell.rawValue}
                column={data.columns[columnIndex]}
                onCommit={(value) => handleCommit(rowIndex, columnIndex, value)}
                onCancel={() => exitEditMode()}
              />
            ) : (
              <CellDisplay
                value={cell.formattedValue}
                isSelected={isSelected}
                onClick={() => selectCell(rowIndex, columnIndex)}
                onDoubleClick={() => enterEditMode(rowIndex, columnIndex)}
              />
            )}
          </div>
        );
      }}
    </FixedSizeGrid>
  );
};
```

---

## Performance Optimizations

Google Sheets achieves high performance through several techniques:

### 1. Virtual Scrolling

```
┌─────────────────────────────────────────────────────────────────┐
│ Virtual Scrolling - Only Render Visible Cells                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Dataset: 10,000 rows × 50 columns = 500,000 cells              │
│                                                                 │
│ WITHOUT virtual scrolling:                                     │
│   DOM nodes: 500,000+ elements                                 │
│   Memory: ~500 MB                                              │
│   Initial render: 5-10 seconds                                 │
│   Scrolling: Janky                                             │
│                                                                 │
│ WITH virtual scrolling:                                        │
│   DOM nodes: ~100 elements (visible viewport)                  │
│   Memory: ~5 MB                                                │
│   Initial render: <100ms                                       │
│   Scrolling: Smooth 60fps                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Implementation: react-window or react-virtualized
```

### 2. Canvas Rendering for Static Content

```typescript
// Draw grid lines and backgrounds on canvas
function drawGrid(ctx: CanvasRenderingContext2D, visibleRange: Range) {
  const { startRow, endRow, startCol, endCol } = visibleRange;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw grid lines
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;

  // Vertical lines
  for (let col = startCol; col <= endCol; col++) {
    const x = getColumnX(col);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let row = startRow; row <= endRow; row++) {
    const y = getRowY(row);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw cell backgrounds (alternating rows, selections)
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const x = getColumnX(col);
      const y = getRowY(row);
      const width = getColumnWidth(col);
      const height = ROW_HEIGHT;

      // Alternating row background
      if (row % 2 === 0) {
        ctx.fillStyle = '#f9f9f9';
        ctx.fillRect(x, y, width, height);
      }

      // Selection highlight
      if (isSelected(row, col)) {
        ctx.fillStyle = 'rgba(66, 133, 244, 0.1)';
        ctx.fillRect(x, y, width, height);
      }

      // Render text (formatted value)
      const cell = getCell(row, col);
      ctx.fillStyle = '#000';
      ctx.font = '13px Arial';
      ctx.fillText(cell.formattedValue, x + 8, y + 20);
    }
  }
}
```

### 3. Memoization & React Optimization

```typescript
// Memoize cell component to prevent unnecessary re-renders
const Cell = React.memo<CellProps>(
  ({ value, rowIndex, colIndex, isEditing, isSelected }) => {
    return isEditing ? (
      <CellEditor value={value} />
    ) : (
      <CellDisplay value={value} isSelected={isSelected} />
    );
  },
  // Custom comparison function
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.isSelected === nextProps.isSelected
    );
  }
);

// Memoize computed values
function GridComponent({ data, columns }: GridProps) {
  // Compute formatted cells only when data changes
  const formattedCells = useMemo(() => {
    return data.map(row =>
      columns.map(col => ({
        rawValue: row[col.id],
        formattedValue: col.formatter ? col.formatter(row[col.id]) : row[col.id]
      }))
    );
  }, [data, columns]);

  return <VirtualizedGrid cells={formattedCells} />;
}
```

### 4. Debounced Updates

```typescript
// Don't save on every keystroke - debounce updates
import { debounce } from 'lodash';

const CellEditor: React.FC<CellEditorProps> = ({
  value,
  onCommit
}) => {
  const [localValue, setLocalValue] = useState(value);

  // Debounce auto-save (but commit immediately on Enter/Tab)
  const debouncedSave = useMemo(
    () => debounce((val) => onCommit(val), 1000),
    [onCommit]
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedSave(newValue); // Auto-save after 1s of inactivity
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      debouncedSave.cancel(); // Cancel debounced save
      onCommit(localValue);   // Commit immediately
    }
  };

  return (
    <input
      value={localValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
    />
  );
};
```

### 5. Web Workers for Heavy Computation

```typescript
// Offload formula calculation to Web Worker
// main.ts
const worker = new Worker('/formula-worker.js');

worker.postMessage({
  type: 'CALCULATE',
  cells: cellData,
  formulas: formulaDefinitions
});

worker.onmessage = (event) => {
  if (event.data.type === 'RESULT') {
    updateCells(event.data.calculatedCells);
  }
};

// formula-worker.js
self.onmessage = (event) => {
  if (event.data.type === 'CALCULATE') {
    const { cells, formulas } = event.data;
    const calculated = calculateAllFormulas(cells, formulas);

    self.postMessage({
      type: 'RESULT',
      calculatedCells: calculated
    });
  }
};
```

---

## React Implementation Patterns

### Complete Cell Component Example

```typescript
import React, { useRef, useEffect, useState } from 'react';

interface CellProps {
  rowIndex: number;
  colIndex: number;
  column: ColumnDefinition;
  value: any;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onEnterEditMode: () => void;
  onCommit: (value: any) => void;
  onCancel: () => void;
}

const Cell: React.FC<CellProps> = ({
  rowIndex,
  colIndex,
  column,
  value,
  isSelected,
  isEditing,
  onSelect,
  onEnterEditMode,
  onCommit,
  onCancel
}) => {
  const formattedValue = column.formatter
    ? column.formatter(value)
    : String(value);

  if (isEditing) {
    return (
      <CellEditor
        value={value}
        column={column}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }

  return (
    <div
      className={cx(
        'cell',
        isSelected && 'cell--selected'
      )}
      onClick={onSelect}
      onDoubleClick={onEnterEditMode}
      tabIndex={isSelected ? 0 : -1}
    >
      {formattedValue}
    </div>
  );
};

// Cell Editor Component
interface CellEditorProps {
  value: any;
  column: ColumnDefinition;
  onCommit: (value: any) => void;
  onCancel: () => void;
}

const CellEditor: React.FC<CellEditorProps> = ({
  value,
  column,
  onCommit,
  onCancel
}) => {
  const [editValue, setEditValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus and select all on mount
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;

      case 'Enter':
        if (!e.shiftKey) {
          e.preventDefault();
          commitValue();
        }
        break;

      case 'Tab':
        e.preventDefault();
        commitValue();
        break;
    }
  };

  const commitValue = () => {
    const parsed = column.parser
      ? column.parser(editValue)
      : editValue;

    const validation = column.validator
      ? column.validator(parsed)
      : { isValid: true };

    if (validation.isValid) {
      onCommit(parsed);
    } else {
      alert(validation.error);
    }
  };

  // Render different input types based on column data type
  switch (column.dataType) {
    case 'select':
      return (
        <select
          ref={inputRef as any}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          className="cell-editor cell-editor--select"
        >
          {column.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'date':
      return (
        <input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          className="cell-editor cell-editor--date"
        />
      );

    case 'boolean':
      return (
        <input
          ref={inputRef as any}
          type="checkbox"
          checked={editValue === 'true'}
          onChange={(e) => setEditValue(String(e.target.checked))}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          className="cell-editor cell-editor--checkbox"
        />
      );

    default:
      return (
        <input
          ref={inputRef}
          type={column.dataType === 'number' ? 'text' : 'text'}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitValue}
          className="cell-editor"
        />
      );
  }
};
```

### Grid State Management

```typescript
import { create } from 'zustand';

interface GridState {
  // Data
  rows: any[][];
  columns: ColumnDefinition[];

  // Selection state
  selectedCell: { row: number; col: number } | null;
  selectedRange: {
    start: { row: number; col: number };
    end: { row: number; col: number };
  } | null;

  // Edit state
  editingCell: { row: number; col: number } | null;

  // Actions
  selectCell: (row: number, col: number) => void;
  enterEditMode: (row?: number, col?: number) => void;
  exitEditMode: (commit: boolean) => void;
  updateCell: (row: number, col: number, value: any) => void;
  moveSelection: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

const useGridStore = create<GridState>((set, get) => ({
  rows: [],
  columns: [],
  selectedCell: null,
  selectedRange: null,
  editingCell: null,

  selectCell: (row, col) => set({
    selectedCell: { row, col },
    editingCell: null
  }),

  enterEditMode: (row, col) => {
    const state = get();
    const cell = row !== undefined && col !== undefined
      ? { row, col }
      : state.selectedCell;

    if (cell) {
      set({ editingCell: cell });
    }
  },

  exitEditMode: (commit) => {
    set({ editingCell: null });
  },

  updateCell: (row, col, value) => set((state) => {
    const newRows = [...state.rows];
    newRows[row] = [...newRows[row]];
    newRows[row][col] = value;
    return { rows: newRows };
  }),

  moveSelection: (direction) => set((state) => {
    if (!state.selectedCell) return {};

    const { row, col } = state.selectedCell;
    let newRow = row;
    let newCol = col;

    switch (direction) {
      case 'up':
        newRow = Math.max(0, row - 1);
        break;
      case 'down':
        newRow = Math.min(state.rows.length - 1, row + 1);
        break;
      case 'left':
        newCol = Math.max(0, col - 1);
        break;
      case 'right':
        newCol = Math.min(state.columns.length - 1, col + 1);
        break;
    }

    return { selectedCell: { row: newRow, col: newCol } };
  })
}));
```

---

## Recommended Libraries

### 1. react-data-grid (Most Sheets-Like)

```bash
npm install react-data-grid
```

**Pros:**
- Built-in cell editing
- Keyboard navigation out of the box
- Copy/paste support
- Virtual scrolling
- Lightweight

**Example:**
```typescript
import DataGrid from 'react-data-grid';

const columns = [
  { key: 'id', name: 'ID' },
  { key: 'task', name: 'Task', editable: true },
  { key: 'quantity', name: 'Quantity', editable: true },
];

<DataGrid
  columns={columns}
  rows={rows}
  onRowsChange={setRows}
/>
```

### 2. AG Grid (Enterprise-Grade)

```bash
npm install ag-grid-react ag-grid-community
```

**Pros:**
- Excel-like editing
- Formula support
- Advanced features (sorting, filtering, grouping)
- Very performant
- Rich API

**Example:**
```typescript
import { AgGridReact } from 'ag-grid-react';

<AgGridReact
  columnDefs={columnDefs}
  rowData={rowData}
  editType="fullRow"
  onCellValueChanged={handleCellChange}
/>
```

### 3. TanStack Table (Headless)

```bash
npm install @tanstack/react-table
```

**Pros:**
- Maximum flexibility
- Build custom UI
- Excellent TypeScript support
- No styling opinions

**Example:**
```typescript
import { useReactTable } from '@tanstack/react-table';

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
});
```

### 4. react-window (Virtual Scrolling)

```bash
npm install react-window
```

**Pros:**
- Best virtual scrolling library
- Extremely performant
- Low-level control

**Example:**
```typescript
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
  columnCount={10}
  columnWidth={120}
  height={600}
  rowCount={1000}
  rowHeight={35}
  width={1200}
>
  {Cell}
</FixedSizeGrid>
```

---

## Line Item Grid Use Case

For your specific use case (editable line items with 10 columns), here's a recommended architecture:

### Schema Definition

```typescript
const lineItemSchema: ColumnDefinition[] = [
  {
    id: 'id',
    name: 'ID',
    dataType: 'string',
    width: 100,
    editable: false,
    defaultValue: () => generateId()
  },
  {
    id: 'type',
    name: 'Type',
    dataType: 'select',
    width: 120,
    options: ['Material', 'Labor', 'Equipment'],
    defaultValue: 'Material'
  },
  {
    id: 'task',
    name: 'Task',
    dataType: 'string',
    width: 200,
    required: true,
    validator: (value) => ({
      isValid: value && value.length > 0,
      error: 'Task name is required'
    })
  },
  {
    id: 'quantity',
    name: 'Quantity',
    dataType: 'number',
    width: 100,
    defaultValue: 0,
    parser: (input) => parseFloat(input) || 0,
    formatter: (value) => value.toFixed(2)
  },
  {
    id: 'unit',
    name: 'Unit',
    dataType: 'string',
    width: 80,
    defaultValue: 'pcs'
  },
  {
    id: 'price',
    name: 'Price',
    dataType: 'currency',
    width: 120,
    parser: (input) => {
      const cleaned = input.replace(/[$,]/g, '');
      return parseFloat(cleaned) || 0;
    },
    formatter: (value) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  },
  {
    id: 'total',
    name: 'Total',
    dataType: 'formula',
    width: 120,
    editable: false,
    formula: (row) => row.quantity * row.price,
    formatter: (value) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  },
  {
    id: 'notes',
    name: 'Notes',
    dataType: 'string',
    width: 200
  },
  {
    id: 'status',
    name: 'Status',
    dataType: 'select',
    width: 120,
    options: ['Pending', 'Approved', 'Ordered', 'Received'],
    defaultValue: 'Pending'
  },
  {
    id: 'vendor',
    name: 'Vendor',
    dataType: 'string',
    width: 150
  }
];
```

### Component Usage

```typescript
import { EditableGrid } from '@/components/EditableGrid';

function LineItemsPage() {
  const [rows, setRows] = useState<LineItemRow[]>([
    /* initial data */
  ]);

  const handleRowsChange = (updatedRows: LineItemRow[]) => {
    setRows(updatedRows);
    // Auto-save to backend
    saveToBackend(updatedRows);
  };

  const handleCellEdit = (rowId: string, field: string, newValue: any) => {
    console.log(`Cell edited: ${rowId}.${field} = ${newValue}`);
  };

  return (
    <div>
      <h1>Line Items</h1>

      <EditableGrid
        columns={lineItemSchema}
        rows={rows}
        onRowsChange={handleRowsChange}
        onCellEdit={handleCellEdit}
        containerHeight="calc(100vh - 200px)"
        stickyHeader
        enableKeyboardNavigation
        enableCopyPaste
      />

      <button onClick={() => addNewRow()}>
        Add Line Item
      </button>
    </div>
  );
}
```

### Keyboard Shortcuts Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ Line Item Grid Keyboard Shortcuts                              │
├─────────────────────────────────────────────────────────────────┤
│ NAVIGATION                                                      │
│  ↑ ↓ ← →         Move between cells                            │
│  Tab             Move right (commit if editing)                 │
│  Shift+Tab       Move left (commit if editing)                  │
│  Enter           Move down (commit if editing)                  │
│  Shift+Enter     Move up                                        │
│  Home            First column in row                            │
│  End             Last column in row                             │
│                                                                 │
│ EDITING                                                         │
│  F2              Enter edit mode                                │
│  Double-click    Enter edit mode                                │
│  Type char       Enter edit mode + type                         │
│  Escape          Cancel edit                                    │
│  Delete          Clear cell                                     │
│  Ctrl/Cmd+C      Copy                                           │
│  Ctrl/Cmd+V      Paste                                          │
│  Ctrl/Cmd+X      Cut                                            │
│                                                                 │
│ ROW OPERATIONS                                                  │
│  Ctrl/Cmd+D      Duplicate row                                  │
│  Ctrl/Cmd+Del    Delete row                                     │
│  Insert          Add row below                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Best Practices

### 1. Data Validation

Always validate before committing:

```typescript
function validateCell(value: any, column: ColumnDefinition): ValidationResult {
  // Required check
  if (column.required && (value === null || value === undefined || value === '')) {
    return { isValid: false, error: `${column.name} is required` };
  }

  // Custom validator
  if (column.validator) {
    return column.validator(value);
  }

  // Type validation
  switch (column.dataType) {
    case 'number':
    case 'currency':
      if (isNaN(value)) {
        return { isValid: false, error: `${column.name} must be a number` };
      }
      break;

    case 'date':
      if (!(value instanceof Date) || isNaN(value.getTime())) {
        return { isValid: false, error: `${column.name} must be a valid date` };
      }
      break;
  }

  return { isValid: true };
}
```

### 2. Optimistic Updates

Update UI immediately, sync to backend asynchronously:

```typescript
function handleCellChange(rowId: string, field: string, newValue: any) {
  // Update UI immediately
  updateLocalState(rowId, field, newValue);

  // Sync to backend
  debouncedSave(rowId, field, newValue);
}

const debouncedSave = debounce(async (rowId, field, value) => {
  try {
    await api.updateLineItem(rowId, { [field]: value });
  } catch (error) {
    // Revert on error
    revertChange(rowId, field);
    showError('Failed to save changes');
  }
}, 500);
```

### 3. Accessibility

Ensure keyboard-only users can use the grid:

- ✅ All cells focusable via Tab
- ✅ Arrow key navigation
- ✅ Screen reader announcements for cell changes
- ✅ ARIA labels and roles
- ✅ Focus indicators visible

### 4. Formula Recalculation

Recalculate dependent cells when source cells change:

```typescript
function updateCellAndRecalculate(
  rowId: string,
  field: string,
  value: any
) {
  // Update the cell
  updateCell(rowId, field, value);

  // Find all formula columns
  const formulaColumns = columns.filter(col => col.dataType === 'formula');

  // Recalculate formulas for this row
  const row = getRow(rowId);
  formulaColumns.forEach(col => {
    if (col.formula) {
      const calculated = col.formula(row);
      updateCell(rowId, col.id, calculated);
    }
  });
}
```

---

## Summary

Google Sheets achieves its smooth editing experience through:

1. **Clear Mode Separation**: Navigation vs. Edit vs. Selection
2. **Dual-Layer Rendering**: Canvas for performance + HTML for flexibility
3. **Virtual Scrolling**: Only render visible cells
4. **Smart Keyboard Handling**: Context-aware key event handling
5. **Type System**: Column-level data types with validation
6. **Optimistic Updates**: Instant UI feedback + async persistence

For your line item grid, I recommend using **react-data-grid** or building a custom solution with **react-window** + **@tanstack/table** for maximum control over the UX.

Would you like me to implement a working prototype of an editable line item grid component?
