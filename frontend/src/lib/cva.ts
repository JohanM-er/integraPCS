import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Example: Button component variants constrained to the limited token set.
 *
 * Usage:
 * ```tsx
 * import { buttonVariants, type ButtonVariants } from '@/lib/cva';
 * import { cx } from '@/lib/cx';
 *
 * interface ButtonProps extends ButtonVariants {
 *   className?: string;
 *   children: React.ReactNode;
 * }
 *
 * export function Button({ variant, size, className, children, ...props }: ButtonProps) {
 *   return (
 *     <button
 *       className={cx(buttonVariants({ variant, size }), className)}
 *       {...props}
 *     >
 *       {children}
 *     </button>
 *   );
 * }
 * ```
 */
export const buttonVariants = cva(
  'rounded-2 inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 hover:bg-brand-500/90 focus-visible:ring-brand-500 text-neutral-50',
        secondary:
          'border border-neutral-900/15 bg-neutral-50 text-neutral-900 hover:bg-neutral-900/10 focus-visible:ring-neutral-900',
        ghost: 'text-neutral-900 hover:bg-neutral-900/10 focus-visible:ring-neutral-900',
        destructive:
          'bg-neutral-900 text-neutral-50 hover:bg-neutral-900/80 focus-visible:ring-neutral-900',
        outline:
          'border border-neutral-900 bg-transparent text-neutral-900 hover:bg-neutral-900/10 focus-visible:ring-neutral-900'
      },
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-2 text-base'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/**
 * Example: Card component variants
 */
export const cardVariants = cva(
  'rounded-2 shadow-1 border border-neutral-900/15 bg-neutral-50 transition-colors',
  {
    variants: {
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
      },
      hover: {
        true: 'hover:bg-neutral-900/10'
      }
    },
    defaultVariants: {
      padding: 'md',
      hover: false
    }
  }
);

export type CardVariants = VariantProps<typeof cardVariants>;

/**
 * Example: Badge component variants
 */
export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide uppercase',
  {
    variants: {
      variant: {
        neutral: 'bg-neutral-900/10 text-neutral-900',
        brand: 'bg-brand-500 text-neutral-50',
        inverse: 'bg-neutral-900 text-neutral-50'
      }
    },
    defaultVariants: {
      variant: 'neutral'
    }
  }
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;

/**
 * Panel variants (GridView-like containers)
 */
export const panelVariants = cva(
  'rounded-2 shadow-1 border border-neutral-900/15 bg-neutral-50 transition-colors',
  {
    variants: {
      tone: {
        default: '',
        brand: 'bg-brand-500 border-brand-500 text-neutral-50',
        inverse: 'border-neutral-900 bg-neutral-900 text-neutral-50'
      },
      padding: {
        none: 'p-0',
        sm: 'p-2',
        md: 'p-4',
        lg: 'p-6'
      },
      emphasis: {
        true: 'ring-brand-500 ring-2 ring-offset-2',
        false: ''
      }
    },
    defaultVariants: {
      tone: 'default',
      padding: 'md',
      emphasis: false
    }
  }
);

export type PanelVariants = VariantProps<typeof panelVariants>;

/**
 * Pill (summary chip) variants
 */
export const pillVariants = cva(
  'inline-flex items-center gap-2 rounded-full border border-neutral-900/15 px-3 py-1 text-sm font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-neutral-50 text-neutral-900',
        brand: 'bg-brand-500 border-transparent text-neutral-50'
      },
      interactive: {
        true: 'cursor-pointer hover:bg-neutral-900/10',
        false: ''
      }
    },
    defaultVariants: {
      tone: 'neutral',
      interactive: false
    }
  }
);

export type PillVariants = VariantProps<typeof pillVariants>;

/**
 * Input variants
 * - Standardizes borders and focus rings with the limited palette
 */
export const inputVariants = cva(
  'rounded-2 focus-visible:ring-brand-500 w-full border border-neutral-900/15 bg-neutral-50 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
  {
    variants: {
      size: {
        sm: 'px-3 py-1 text-sm',
        md: 'px-3 py-2 text-base',
        lg: 'px-4 py-3 text-lg'
      },
      invalid: {
        true: 'border-neutral-900 focus-visible:ring-neutral-900',
        false: ''
      }
    },
    defaultVariants: {
      size: 'md',
      invalid: false
    }
  }
);

export type InputVariants = VariantProps<typeof inputVariants>;

/**
 * Table shell variants
 * - Controls density, borders, and header tone
 */
export const tableVariants = cva('', {
  variants: {
    density: {
      compact: 'text-sm [&_td]:py-2 [&_th]:py-2',
      normal: 'text-base [&_td]:py-3 [&_th]:py-3',
      spacious: 'text-lg [&_td]:py-4 [&_th]:py-4'
    },
    borders: {
      row: '[&_tr]:border-b [&_tr]:border-neutral-900/15',
      all: 'border-neutral-900/15 [&_td]:border [&_th]:border',
      none: ''
    },
    headerTone: {
      default: '[&_th]:bg-neutral-900/10 [&_th]:text-neutral-900',
      none: ''
    }
  },
  defaultVariants: {
    density: 'compact',
    borders: 'row',
    headerTone: 'default'
  }
});

export type TableVariants = VariantProps<typeof tableVariants>;
