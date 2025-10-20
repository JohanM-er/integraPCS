import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Example: Button component variants
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
  'inline-flex items-center justify-center rounded-2xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500',
        secondary:
          'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 focus-visible:ring-neutral-400',
        ghost: 'hover:bg-neutral-100 focus-visible:ring-neutral-400',
        destructive:
          'bg-error-500 text-white hover:bg-error-600 focus-visible:ring-error-500',
        outline:
          'border border-neutral-300 bg-transparent hover:bg-neutral-100 focus-visible:ring-neutral-400'
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base'
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
export const cardVariants = cva('rounded-xl border bg-white shadow-sm', {
  variants: {
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8'
    },
    hover: {
      true: 'transition-shadow hover:shadow-md'
    }
  },
  defaultVariants: {
    padding: 'md',
    hover: false
  }
});

export type CardVariants = VariantProps<typeof cardVariants>;

/**
 * Example: Badge component variants
 */
export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-neutral-100 text-neutral-900',
        success: 'bg-success-500/10 text-success-500',
        warning: 'bg-warning-500/10 text-warning-500',
        error: 'bg-error-500/10 text-error-500',
        brand: 'bg-brand-500/10 text-brand-500'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
