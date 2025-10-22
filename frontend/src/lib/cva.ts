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
  'inline-flex items-center justify-center rounded-full',
  {
    variants: {
      variant: {
        neutral: 'bg-neutral-900/10 text-neutral-900',
        brand: 'bg-brand-500 text-neutral-50',
        inverse: 'bg-neutral-900 text-neutral-50'
      },
      size: {
        sm: 'px-1.5 py-0 text-sm min-w-10',
        md: 'px-2 py-0.5 text-base min-w-16',
        lg: 'px-2.5 py-0.5 text-lg min-w-18'
      }
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md'
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
      compact: '[&_td]:py-1 [&_td]:text-sm [&_th]:py-1 [&_th]:text-sm',
      normal: '[&_td]:py-2 [&_td]:text-base [&_th]:py-2 [&_th]:text-base',
      spacious: '[&_td]:py-3 [&_td]:text-lg [&_th]:py-3 [&_th]:text-lg'
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

export const toolbarVariants = cva(
  'flex items-center justify-between gap-4',
  {
    variants: {
      padding: {
        sm: 'p-2',
        md: 'p-4',
        lg: 'p-6'
      },
      border: {
        none: '',
        bottom: 'border-b border-neutral-900/15'
      },
      tone: {
        default: '',
        muted: 'bg-neutral-900/10'
      }
    },
    defaultVariants: {
      padding: 'md',
      border: 'bottom',
      tone: 'default'
    }
  }
);

export type ToolbarVariants = VariantProps<typeof toolbarVariants>;

export const footerVariants = cva(
  'flex items-center justify-between text-sm',
  {
    variants: {
      padding: {
        sm: 'p-2',
        md: 'p-4',
        lg: 'p-6'
      },
      border: {
        none: '',
        top: 'border-t border-neutral-900/15'
      },
      tone: {
        default: '',
        muted: 'bg-neutral-900/10'
      }
    },
    defaultVariants: {
      padding: 'sm',
      border: 'top',
      tone: 'default'
    }
  }
);

export type FooterVariants = VariantProps<typeof footerVariants>;
