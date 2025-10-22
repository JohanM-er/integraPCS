import { forwardRef, useId } from 'react';
import { cx } from '@/lib/cx';
import {
  panelVariants,
  pillVariants,
  badgeVariants,
  tableVariants,
  toolbarVariants,
  footerVariants,
  type BadgeVariants,
  type TableVariants
} from '@/lib/cva';

export interface WorkPackageRow {
  id: string;
  name: string;
  owner: string;
  phase: 'Plan' | 'Design' | 'Build' | 'Test' | 'Deploy' | string;
  start: string | Date;
  end: string | Date;
  status: 'On Track' | 'At Risk' | 'Blocked' | 'Complete' | string;
  score?: number;
}

export interface GridFilter {
  id: string;
  label: string;
  value: string;
  selected?: boolean;
  onClick?: (id: string) => void;
  onClear?: (id: string) => void;
}

export interface GridMetadata {
  rowsCount: number;
  columnsSelected?: number;
  lastSyncText?: string;
}

export interface WorkPackageGridProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  rows: WorkPackageRow[];
  filters?: GridFilter[];
  metadata?: GridMetadata;
  density?: TableVariants['density'];
  borders?: TableVariants['borders'];
  headerTone?: TableVariants['headerTone'];
  stickyHeader?: boolean;
  showFooter?: boolean;
  ariaLabel?: string;
  onRowClick?: (row: WorkPackageRow) => void;
}

type WorkPackageStatus = WorkPackageRow['status'];

function statusToBadgeVariant(status: WorkPackageStatus): BadgeVariants['variant'] {
  return status === 'On Track' ? 'brand' : 'neutral';
}

function densityToBadgeSize(density: TableVariants['density']): BadgeVariants['size'] {
  switch (density) {
    case 'compact':
    case 'normal':
    case 'spacious':
    default:
      return 'sm';
  }
}

function formatDate(value: string | Date): string {
  if (typeof value === 'string') return value;
  try {
    return value.toLocaleDateString();
  } catch {
    return String(value);
  }
}

/**
 * WorkPackageGrid - An operational snapshot grid with toolbar, table, and footer.
 */
export const WorkPackageGrid = forwardRef<HTMLDivElement, WorkPackageGridProps>(
  (
    {
      title = 'Operational Snapshot',
      rows,
      filters = [],
      metadata,
      density = 'normal',
      borders = 'row',
      headerTone = 'default',
      stickyHeader = false,
      showFooter = true,
      ariaLabel,
      onRowClick,
      className,
      ...rest
    },
    ref
  ) => {
    const titleId = useId();
    return (
      <div ref={ref} className={cx(panelVariants(), className)} {...rest}>
        <header className={toolbarVariants({ padding: 'md', border: 'bottom', tone: 'default' })}>
          <h2 id={titleId} className="text-base font-semibold text-neutral-900">{title}</h2>
          {filters.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => f.onClick?.(f.id)}
                  className={cx(
                    pillVariants({ tone: f.selected ? 'brand' : 'neutral', interactive: true })
                  )}
                  aria-pressed={!!f.selected}
                >
                  <span className="font-medium">{f.label}:</span>
                  <span>{f.value}</span>
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div className="overflow-auto">
          <table
            aria-label={ariaLabel || title || 'Work package grid'}
            aria-labelledby={titleId}
            className={cx('w-full', tableVariants({ density, borders, headerTone }))}
          >
            <thead
              className={cx(
                stickyHeader && 'sticky top-0',
                stickyHeader && headerTone === 'none' && 'bg-neutral-50'
              )}
            >
              <tr>
                <th scope="col" className="px-3 text-left font-semibold">
                  ID
                </th>
                <th scope="col" className="px-3 text-left font-semibold">
                  Name
                </th>
                <th scope="col" className="px-3 text-left font-semibold">
                  Owner
                </th>
                <th scope="col" className="px-3 text-left font-semibold">
                  Phase
                </th>
                <th scope="col" className="px-3 text-left font-semibold">
                  Start
                </th>
                <th scope="col" className="px-3 text-left font-semibold">
                  End
                </th>
                <th scope="col" className="px-3 text-left font-semibold">
                  Status
                </th>
                <th scope="col" className="px-3 text-left font-semibold">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cx('hover:bg-neutral-900/10', onRowClick && 'cursor-pointer')}
                  onClick={() => onRowClick?.(r)}
                >
                  <td className="px-3">{r.id}</td>
                  <td className="px-3 font-medium">
                    {onRowClick ? (
                      <button
                        type="button"
                        className="font-medium text-left rounded-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(r);
                        }}
                      >
                        {r.name}
                      </button>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-3">{r.owner}</td>
                  <td className="px-3">{r.phase}</td>
                  <td className="px-3">{formatDate(r.start)}</td>
                  <td className="px-3">{formatDate(r.end)}</td>
                  <td className="px-3">
                    <span className={badgeVariants({ variant: statusToBadgeVariant(r.status), size: densityToBadgeSize(density) })}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3">{typeof r.score === 'number' ? r.score : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showFooter && metadata ? (
          <footer className={footerVariants({ padding: 'sm', border: 'top', tone: 'default' })}>
            <div className="text-neutral-900">
              {metadata.rowsCount} rows
              {typeof metadata.columnsSelected === 'number'
                ? ` · ${metadata.columnsSelected} columns selected`
                : ''}
            </div>
            <div className="text-neutral-900">
              {metadata.lastSyncText ? `Last sync: ${metadata.lastSyncText}` : null}
            </div>
          </footer>
        ) : null}
      </div>
    );
  }
);

WorkPackageGrid.displayName = 'WorkPackageGrid';