import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { cx } from '@/lib/cx';
import {
  inputVariants,
  tableVariants,
  gridCellVariants,
  type TableVariants
} from '@/lib/cva';

/**
 * Column type identifier
 */
export type GridColumnType = 'string' | 'number' | 'currency' | 'date' | 'boolean' | 'select';

export interface GridColumn<T> {
  key: Extract<keyof T, string>;
  header: React.ReactNode;
  type: GridColumnType;
  readOnly?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;

  // Formatting/parsing/validation
  formatter?: (
    value: unknown,
    row: T,
    ctx: { rowIndex: number; colIndex: number; column: GridColumn<T> }
  ) => React.ReactNode;
  parser?: (
    input: string,
    row: T,
    ctx: { rowIndex: number; colIndex: number; column: GridColumn<T> }
  ) => unknown;
  validator?: (
    value: unknown,
    row: T,
    ctx: { rowIndex: number; colIndex: number; column: GridColumn<T> }
  ) => string | null;

  // Accessors (optional). If absent, key-based access is used.
  getValue?: (row: T) => unknown;
  setValue?: (row: T, value: unknown) => T;

  // Type-specific config
  options?: Array<{ label: string; value: unknown }>; // for select/boolean
  step?: number; // for number/currency
  min?: number;
  max?: number;
  locale?: string; // currency/date formatting
  currency?: string; // currency code for currency type
  dateFormatOptions?: Intl.DateTimeFormatOptions; // display formatting for date
  editorProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onKeyDown' | 'autoFocus' | 'ref'>;
}

export type GridSchema<T> = GridColumn<T>[];

export type GridCellCoords = { rowIndex: number; colIndex: number };

export interface CellEditEvent<T> {
  rowIndex: number;
  colIndex: number;
  row: T;
  column: GridColumn<T>;
  previousValue: unknown;
  nextValue: unknown;
  valid: boolean;
  error?: string | null;
  commitCause: 'enter' | 'tab' | 'shift+tab' | 'clickOutside' | 'blur' | 'programmatic';
}

type MoneyOptions = {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export interface TCompProps<T> extends React.HTMLAttributes<HTMLTableElement> {
  data: T[];
  columns: GridSchema<T>;

  // Visual variants
  density?: TableVariants['density'];
  borders?: TableVariants['borders'];
  headerTone?: TableVariants['headerTone'];
  striped?: boolean;
  hoverable?: boolean;
  selectable?: boolean;
  stickyHeader?: boolean;

  // Scroll container (internal overflow)
  containerHeight?: string;
  containerMaxHeight?: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;

  // Identity
  rowKey?: (row: T, index: number) => string;

  // Events
  onChange?: (nextData: T[]) => void;
  onCellEdit?: (event: CellEditEvent<T>) => void;

  // Formatting defaults
  defaultLocale?: string;
  defaultCurrency?: string;

  // Accessibility
  ariaLabel?: string;
}

/* ============================================
   Utility helpers
   ============================================ */

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function keyFor(coord: GridCellCoords): string {
  return `${coord.rowIndex}:${coord.colIndex}`;
}

function getValue<T extends Record<string, any>>(row: T, col: GridColumn<T>): unknown {
  return col.getValue ? col.getValue(row) : (row as any)[col.key];
}

function setValue<T extends Record<string, any>>(row: T, col: GridColumn<T>, v: unknown): T {
  if (col.setValue) return col.setValue(row, v);
  return { ...(row as any), [col.key]: v } as T;
}

function formatCurrency(
  value: number,
  {
    locale = 'en-US',
    currency = 'USD',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  }: MoneyOptions = {}
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits
    }).format(value);
  } catch {
    return String(value);
  }
}

function formatNumber(value: number, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(value);
  } catch {
    return String(value);
  }
}

function formatDateDisplay(value: unknown, locale = 'en-US', opts?: Intl.DateTimeFormatOptions): string {
  let d: Date | null = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string') {
    const parsed = new Date(value);
    d = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return d.toISOString();
  }
}

function toDateInputValue(value: unknown): string {
  const date =
    value instanceof Date
      ? value
      : typeof value === 'string'
        ? new Date(value)
        : value && typeof (value as any).getTime === 'function'
          ? (value as Date)
          : null;

  if (!date || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/* ============================================
   TComp - Main component
   ============================================ */

export const TComp = forwardRef(function TComp<T extends Record<string, any>>(
  {
    data,
    columns,
    density = 'normal',
    borders = 'row',
    headerTone = 'default',
    striped = false,
    hoverable = true,
    selectable = true,
    stickyHeader,
    containerHeight,
    containerMaxHeight,
    containerClassName,
    containerStyle,
    rowKey = (_row, idx) => String(idx),
    onChange,
    onCellEdit,
    defaultLocale = 'en-US',
    defaultCurrency = 'USD',
    ariaLabel = 'Editable grid',
    className,
    ...rest
  }: TCompProps<T>,
  ref: React.ForwardedRef<HTMLTableElement>
) {
  const [selectedCell, setSelectedCell] = useState<GridCellCoords | undefined>(() => {
    if (data.length > 0 && columns.length > 0) return { rowIndex: 0, colIndex: 0 };
    return undefined;
  });
  const [editingCell, setEditingCell] = useState<GridCellCoords | undefined>(undefined);
  const [draftValue, setDraftValue] = useState<unknown>('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [selectAllOnMount, setSelectAllOnMount] = useState(false);

  // For click-outside commit
  const cellRefMap = useRef(new Map<string, HTMLTableCellElement>());

  // Focus the selected cell
  useEffect(() => {
    if (!selectedCell) return;
    const el = cellRefMap.current.get(keyFor(selectedCell));
    if (el) {
      el.focus();
    }
  }, [selectedCell]);

  const derivedStickyHeader =
    typeof stickyHeader === 'boolean' ? stickyHeader : Boolean(containerHeight || containerMaxHeight);

  const wrapperStyle: React.CSSProperties = {
    ...(containerStyle || {}),
    ...(containerHeight ? { height: containerHeight } : {}),
    ...(containerMaxHeight ? { maxHeight: containerMaxHeight } : {})
  };

  const isEditing = Boolean(editingCell);

  const moveSelection = useCallback(
    (deltaRow: number, deltaCol: number) => {
      setSelectedCell(prev => {
        const next = {
          rowIndex: clamp((prev?.rowIndex ?? 0) + deltaRow, 0, Math.max(0, data.length - 1)),
          colIndex: clamp((prev?.colIndex ?? 0) + deltaCol, 0, Math.max(0, columns.length - 1))
        };
        return next;
      });
    },
    [data.length, columns.length]
  );

  const startEdit = useCallback(
    (trigger: 'enter' | 'f2' | 'type', initialChar?: string) => {
      if (!selectedCell) return;
      const { rowIndex, colIndex } = selectedCell;
      const col = columns[colIndex];
      if (!col || col.readOnly) return;

      const row = data[rowIndex];
      const current = getValue(row, col);

      setEditingCell(selectedCell);
      setDraftError(null);

      if (trigger === 'type' && typeof initialChar === 'string') {
        // Start with typed char for text-like fields
        if (col.type === 'boolean') {
          // For boolean, treat typed char as a toggle signal instead
          const prev = Boolean(current);
          const next = !prev;
          if (onCellEdit) {
            onCellEdit({
              rowIndex,
              colIndex,
              row,
              column: col,
              previousValue: current,
              nextValue: next,
              valid: true,
              error: null,
              commitCause: 'programmatic'
            });
          }
          if (onChange) {
            const nextData = data.map((r, i) => (i === rowIndex ? setValue(r, col, next) : r));
            onChange(nextData as T[]);
          }
          setEditingCell(undefined);
          setDraftValue('');
          setDraftError(null);
          return;
        }
        setDraftValue(initialChar);
        setSelectAllOnMount(false);
      } else {
        // Initialize with current value string for input fields
        if (col.type === 'date') {
          setDraftValue(toDateInputValue(current));
        } else if (col.type === 'boolean') {
          setDraftValue(Boolean(current));
        } else if (typeof current === 'number') {
          setDraftValue(String(current));
        } else if (current == null) {
          setDraftValue('');
        } else {
          setDraftValue(String(current));
        }
        setSelectAllOnMount(true);
      }
    },
    [columns, data, onCellEdit, onChange, selectedCell]
  );

  const finishCommitNavigation = useCallback(
    (cause: CellEditEvent<any>['commitCause']) => {
      if (!selectedCell) return;
      if (cause === 'tab') {
        moveSelection(0, 1);
      } else if (cause === 'shift+tab') {
        moveSelection(0, -1);
      } else if (cause === 'enter') {
        moveSelection(1, 0);
      }
    },
    [moveSelection, selectedCell]
  );

  const commitEdit = useCallback(
    (cause: CellEditEvent<any>['commitCause']) => {
      if (!editingCell) return;

      const { rowIndex, colIndex } = editingCell;
      const row = data[rowIndex];
      const col = columns[colIndex];
      const prev = getValue(row, col);

      // Use parser or default based on column.type
      let parsed: unknown = draftValue;
      if (col.parser) {
        parsed = col.parser(String(draftValue ?? ''), row, { rowIndex, colIndex, column: col });
      } else {
        switch (col.type) {
          case 'string': {
            parsed = String(draftValue ?? '');
            break;
          }
          case 'number': {
            const num = Number(String(draftValue ?? ''));
            parsed = Number.isNaN(num) ? NaN : num;
            break;
          }
          case 'currency': {
            const num = Number(String(draftValue ?? ''));
            parsed = Number.isNaN(num) ? NaN : num;
            break;
          }
          case 'date': {
            if (draftValue === '' || draftValue == null) {
              parsed = null;
            } else if (draftValue instanceof Date) {
              parsed = draftValue;
            } else if (typeof draftValue === 'string') {
              const d = new Date(draftValue as string);
              parsed = Number.isNaN(d.getTime()) ? null : d;
            } else {
              parsed = null;
            }
            break;
          }
          case 'boolean': {
            parsed = Boolean(draftValue);
            break;
          }
          case 'select': {
            // If options provided, try to match by string equivalence to retain option type
            if (col.options && typeof draftValue === 'string') {
              const found = col.options.find(opt => String(opt.value) === String(draftValue));
              parsed = found ? found.value : draftValue;
            } else {
              parsed = draftValue;
            }
            break;
          }
          default: {
            parsed = draftValue;
          }
        }
      }

      const error = col.validator ? col.validator(parsed, row, { rowIndex, colIndex, column: col }) : null;
      const valid = !error;

      if (onCellEdit) {
        onCellEdit({
          rowIndex,
          colIndex,
          row,
          column: col,
          previousValue: prev,
          nextValue: parsed,
          valid,
          error,
          commitCause: cause
        });
      }

      // If invalid, keep editor open and show error
      if (!valid) {
        setDraftError(error ?? 'Invalid');
        return;
      }

      if (onChange) {
        const nextData = data.map((r, i) => (i === rowIndex ? setValue(r, col, parsed) : r));
        onChange(nextData as T[]);
      }

      setEditingCell(undefined);
      setDraftValue('');
      setDraftError(null);
      finishCommitNavigation(cause);
    },
    [columns, data, draftValue, editingCell, finishCommitNavigation, onCellEdit, onChange]
  );

  const cancelEdit = useCallback(() => {
    setEditingCell(undefined);
    setDraftValue('');
    setDraftError(null);
  }, []);

  // Commit on click outside of the active editing cell
  const handleMouseDownCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!editingCell) return;
      const activeTd = cellRefMap.current.get(keyFor(editingCell));
      if (activeTd && activeTd.contains(e.target as Node)) return;
      commitEdit('clickOutside');
    },
    [editingCell, commitEdit]
  );

  // Keyboard handling (navigation mode only)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditing) return;

      const isTyping =
        e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1, 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1, 0);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveSelection(0, -1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveSelection(0, 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        startEdit('enter');
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        startEdit('f2');
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) moveSelection(0, -1);
        else moveSelection(0, 1);
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        // Toggle boolean in navigation mode
        if (selectedCell) {
          const { rowIndex, colIndex } = selectedCell;
          const col = columns[colIndex];
          if (col && col.type === 'boolean' && !col.readOnly) {
            e.preventDefault();
            const row = data[rowIndex];
            const curr = Boolean(getValue(row, col));
            const next = !curr;

            if (onCellEdit) {
              onCellEdit({
                rowIndex,
                colIndex,
                row,
                column: col,
                previousValue: curr,
                nextValue: next,
                valid: true,
                error: null,
                commitCause: 'programmatic'
              });
            }
            if (onChange) {
              const nextData = data.map((r, i) => (i === rowIndex ? setValue(r, col, next) : r));
              onChange(nextData as T[]);
            }
            return;
          }
        }
      }
      if (isTyping) {
        e.preventDefault();
        startEdit('type', e.key);
      }
    },
    [columns, data, isEditing, moveSelection, onCellEdit, onChange, selectedCell, startEdit]
  );

  // Cell ref setter
  const setCellRef = useCallback((rowIndex: number, colIndex: number, el: HTMLTableCellElement | null) => {
    const k = keyFor({ rowIndex, colIndex });
    if (el) cellRefMap.current.set(k, el);
    else cellRefMap.current.delete(k);
  }, []);

  // Render helpers
  const getCellAlign = useCallback((col: GridColumn<any>): 'left' | 'center' | 'right' => {
    if (col.align) return col.align;
    if (col.type === 'number' || col.type === 'currency') return 'right';
    return 'left';
  }, []);

  return (
    <div
      className={cx('overflow-auto', containerClassName)}
      // eslint-disable-next-line no-restricted-syntax -- Internal scroll container: dynamic height/maxHeight from props
      style={wrapperStyle}
      onMouseDownCapture={handleMouseDownCapture}
    >
      <table
        ref={ref}
        aria-label={ariaLabel}
        className={cx(
          'w-full',
          tableVariants({
            density,
            borders,
            headerTone,
            striped: striped ? 'on' : 'off',
            hoverable: hoverable ? 'on' : 'off',
            selectable: selectable ? 'on' : 'off'
          }),
          className
        )}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <thead
          className={cx(
            derivedStickyHeader && 'sticky top-0',
            derivedStickyHeader && headerTone === 'none' && 'bg-surface-table-header'
          )}
        >
          <tr>
            {columns.map((col, colIndex) => (
              <th key={`h-${colIndex}`} scope="col" className="px-3 text-left font-semibold">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowKey(row, rowIndex)}
              aria-selected={selectedCell?.rowIndex === rowIndex || undefined}
            >
              {columns.map((col, colIndex) => {
                const coord = { rowIndex, colIndex };
                const selected =
                  selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex;
                const editing =
                  editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;

                const align = getCellAlign(col);
                const state: Parameters<typeof gridCellVariants>[0] extends infer P
                  ? P extends { state?: infer S }
                    ? S
                    : never
                  : never =
                  editing ? 'editing' : selected ? 'selected' : 'default';

                const value = getValue(row as any, col as any);

                return (
                  <td
                    key={col.key as string}
                    ref={el => setCellRef(rowIndex, colIndex, el)}
                    tabIndex={selected ? 0 : -1}
                    aria-selected={selected || undefined}
                    className={cx(
                      gridCellVariants({
                        align,
                        state: draftError && editing ? 'invalid' : (state as any),
                        interactive: col.readOnly ? 'off' : 'on'
                      }),
                      col.className
                    )}
                    onClick={() => {
                      setSelectedCell(coord);
                    }}
                    onDoubleClick={() => {
                      if (!col.readOnly) startEdit('enter');
                    }}
                  >
                    {editing ? (
                      <CellEditor
                        value={value}
                        column={col as GridColumn<Record<string, any>>}
                        invalid={Boolean(draftError)}
                        autoFocus
                        selectAllOnMount={selectAllOnMount}
                        onDraftChange={setDraftValue}
                        onCommit={commitEdit}
                        onCancel={cancelEdit}
                      />
                    ) : (
                      <CellDisplay
                        value={value}
                        row={row}
                        column={col as GridColumn<Record<string, any>>}
                        locale={col.locale || defaultLocale}
                        currency={col.currency || defaultCurrency}
                        rowIndex={rowIndex}
                        colIndex={colIndex}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}) as <T extends Record<string, any>>(
  props: TCompProps<T> & React.RefAttributes<HTMLTableElement>
) => JSX.Element;

TComp.displayName = 'TComp';

/* ============================================
   Cell display (memoized)
   ============================================ */

interface CellDisplayProps<T> {
  value: unknown;
  row: T;
  column: GridColumn<T>;
  locale: string;
  currency: string;
  rowIndex: number;
  colIndex: number;
}

const CellDisplay = memo(function CellDisplay<T>({
  value,
  row,
  column,
  locale,
  currency,
  rowIndex,
  colIndex
}: CellDisplayProps<T>) {
  if (column.formatter) {
    return <>{column.formatter(value, row, { rowIndex, colIndex, column })}</>;
  }

  switch (column.type) {
    case 'string': {
      return <>{String(value ?? '')}</>;
    }
    case 'number': {
      const num =
        typeof value === 'number'
          ? value
          : value == null
            ? 0
            : Number.isNaN(Number(value))
              ? NaN
              : Number(value);
      return <>{Number.isNaN(num) ? '' : formatNumber(num, locale)}</>;
    }
    case 'currency': {
      const num =
        typeof value === 'number'
          ? value
          : value == null
            ? 0
            : Number.isNaN(Number(value))
              ? NaN
              : Number(value);
      return <>{Number.isNaN(num) ? '' : formatCurrency(num, { locale, currency })}</>;
    }
    case 'date': {
      return <>{formatDateDisplay(value, locale, column.dateFormatOptions)}</>;
    }
    case 'boolean': {
      const bool = Boolean(value);
      return <>{bool ? 'Yes' : 'No'}</>;
    }
    case 'select': {
      if (!column.options) return <>{String(value ?? '')}</>;
      const match = column.options.find(opt => String(opt.value) === String(value));
      return <>{match ? match.label : String(value ?? '')}</>;
    }
    default: {
      return <>{String(value ?? '')}</>;
    }
  }
}) as <T, P extends CellDisplayProps<T>>(props: P) => JSX.Element;

/* ============================================
   Cell editor (memoized)
   ============================================ */

interface CellEditorProps<T> {
  value: unknown;
  column: GridColumn<T>;
  onDraftChange: (next: unknown) => void;
  onCommit: (cause: CellEditEvent<T>['commitCause']) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  selectAllOnMount?: boolean;
  invalid?: boolean;
}

const CellEditor = memo(function CellEditor<T>({
  value,
  column,
  onDraftChange,
  onCommit,
  onCancel,
  autoFocus = true,
  selectAllOnMount = false,
  invalid = false
}: CellEditorProps<T>) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const el = inputRef.current;
    if (!el) return;
    if (selectAllOnMount && 'select' in el) {
      try {
        (el as HTMLInputElement).select();
      } catch {
        // ignore
      }
    } else {
      try {
        el.focus();
      } catch {
        // ignore
      }
    }
  }, [autoFocus, selectAllOnMount]);

  const stopNavPropagation = (e: React.KeyboardEvent) => {
    // Prevent table-level navigation from swallowing editor keystrokes
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown'
    ) {
      e.stopPropagation();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    stopNavPropagation(e);
    if (e.key === 'Enter') {
      e.preventDefault();
      onCommit('enter');
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      onCommit(e.shiftKey ? 'shift+tab' : 'tab');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
  };

  if (column.type === 'boolean') {
    const checked = Boolean(value);
    return (
      <input
        ref={el => (inputRef.current = el)}
        type="checkbox"
        className={cx('cursor-pointer')}
        checked={checked}
        onChange={e => {
          onDraftChange(e.target.checked);
          onCommit('programmatic');
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => onCommit('blur')}
      />
    );
  }

  if (column.type === 'select') {
    const opts = column.options || [];
    const currentStr = String(value ?? '');
    return (
      <select
        ref={el => (inputRef.current = el)}
        className={inputVariants({ size: 'md', invalid: invalid ? true : false })}
        value={
          // Ensure string value for native select
          currentStr
        }
        onChange={e => {
          const selectedStr = e.target.value;
          const match = opts.find(o => String(o.value) === selectedStr);
          onDraftChange(match ? match.value : selectedStr);
          // Commit on select change for immediacy
          onCommit('programmatic');
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => onCommit('blur')}
      >
        {opts.map((o, i) => (
          <option key={`${String(o.value)}-${i}`} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  // For string/number/currency/date we use input
  const inputType =
    column.type === 'number' || column.type === 'currency'
      ? 'number'
      : column.type === 'date'
        ? 'date'
        : 'text';

  const step =
    column.type === 'number' || column.type === 'currency'
      ? column.step ?? (column.type === 'currency' ? 0.01 : 1)
      : undefined;

  const min = column.min;
  const max = column.max;

  const inputValue =
    column.type === 'date' ? toDateInputValue(value) : value == null ? '' : String(value);

  return (
    <input
      ref={el => (inputRef.current = el)}
      type={inputType}
      className={inputVariants({ size: 'md', invalid: invalid ? true : false })}
      value={inputValue}
      step={step as number | undefined}
      min={typeof min === 'number' ? min : undefined}
      max={typeof max === 'number' ? max : undefined}
      onChange={e => onDraftChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onCommit('blur')}
      {...(column.editorProps || {})}
    />
  );
}) as <T, P extends CellEditorProps<T>>(props: P) => JSX.Element;