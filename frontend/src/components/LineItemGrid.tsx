import { forwardRef } from 'react';

import { tableVariants, type TableVariants } from '@/lib/cva';
import { cx } from '@/lib/cx';

export interface LineItemRow {
  id: string;
  type: 'Material' | 'Labor' | 'Equipment' | string;
  task: string;
  quantity: number;
  unit: string;
  price: number; // unit price
  total?: number; // optional override; defaults to quantity * price
}

export interface LineItemGridProps extends React.HTMLAttributes<HTMLTableElement> {
  rows: LineItemRow[];
  density?: TableVariants['density'];
  borders?: TableVariants['borders'];
  headerTone?: TableVariants['headerTone'];
  striped?: boolean;
  hoverable?: boolean;
  selectable?: boolean;
  stickyHeader?: boolean;
  ariaLabel?: string;
  onRowClick?: (row: LineItemRow) => void;
  locale?: string; // default: 'en-US'
  currency?: string; // default: 'USD'

  // Internal scroll container configuration
  containerHeight?: string;
  containerMaxHeight?: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
}

type MoneyOptions = {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

function formatCurrency(
  value: number,
  {
    locale = 'en-US',
    currency = 'USD',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  }: MoneyOptions
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

function getTotal(row: LineItemRow): number {
  return typeof row.total === 'number' ? row.total : row.quantity * row.price;
}

/**
 * LineItemGrid - Pure table component for construction line items with an internal scroll container.
 *
 * - Renders an overflow wrapper div containing the table (ref forwards to the HTMLTableElement).
 * - Sticky header can be explicitly controlled via the stickyHeader prop, or
 *   auto-enabled when containerHeight or containerMaxHeight is provided.
 *
 * Scroll container props:
 * - containerHeight: fixed height for the internal scroll wrapper (e.g., '24rem', '480px', '50vh')
 * - containerMaxHeight: max height for the internal scroll wrapper (e.g., '100vh')
 * - containerClassName: additional class names for the wrapper div
 * - containerStyle: inline styles merged into the wrapper div
 */
export const LineItemGrid = forwardRef<HTMLTableElement, LineItemGridProps>(
  (
    {
      rows,
      density = 'normal',
      borders = 'row',
      headerTone = 'default',
      striped = false,
      hoverable = true,
      selectable = true,
      stickyHeader,
      ariaLabel,
      onRowClick,
      locale = 'en-US',
      currency = 'USD',
      className,
      containerHeight,
      containerMaxHeight,
      containerClassName,
      containerStyle,
      ...rest
    },
    ref
  ) => {
    const derivedStickyHeader =
      typeof stickyHeader === 'boolean'
        ? stickyHeader
        : Boolean(containerHeight || containerMaxHeight);

    const wrapperStyle: React.CSSProperties = {
      ...(containerStyle || {}),
      ...(containerHeight ? { height: containerHeight } : {}),
      ...(containerMaxHeight ? { maxHeight: containerMaxHeight } : {})
    };

    return (
      <div
        className={cx('overflow-auto', containerClassName)}
        // eslint-disable-next-line no-restricted-syntax -- Internal scroll container: dynamic height/maxHeight from props
        style={wrapperStyle}
      >
        <table
          ref={ref}
          aria-label={ariaLabel || 'Line items table'}
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
          {...rest}
        >
          <thead
            className={cx(
              derivedStickyHeader && 'sticky top-0',
              derivedStickyHeader && headerTone === 'none' && 'bg-surface-table-header'
            )}
          >
            <tr>
              <th scope="col" className="px-3 text-left font-semibold">
                ID
              </th>
              <th scope="col" className="px-3 text-left font-semibold">
                Type
              </th>
              <th scope="col" className="px-3 text-left font-semibold">
                Task
              </th>
              <th scope="col" className="px-3 text-right font-semibold">
                Quantity
              </th>
              <th scope="col" className="px-3 text-left font-semibold">
                Unit
              </th>
              <th scope="col" className="px-3 text-right font-semibold">
                Price
              </th>
              <th scope="col" className="px-3 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.id}
                className={cx(onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(r)}
              >
                <td className="px-3">{r.id}</td>
                <td className="px-3">{r.type}</td>
                <td className="px-3 font-medium">
                  {onRowClick ? (
                    <button
                      type="button"
                      className="rounded-2 focus-visible:ring-brand-500 text-left font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      onClick={e => {
                        e.stopPropagation();
                        onRowClick(r);
                      }}
                    >
                      {r.task}
                    </button>
                  ) : (
                    r.task
                  )}
                </td>
                <td className="px-3 text-right">{r.quantity}</td>
                <td className="px-3">{r.unit}</td>
                <td className="px-3 text-right">{formatCurrency(r.price, { locale, currency })}</td>
                <td className="px-3 text-right">
                  {formatCurrency(getTotal(r), { locale, currency })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

LineItemGrid.displayName = 'LineItemGrid';
