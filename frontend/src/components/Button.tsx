import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { buttonVariants, type ButtonVariants } from '@/lib/cva';
import { cx } from '@/lib/cx';

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariants {
  children: React.ReactNode;
  className?: string;
}

/**
 * Button component with variants
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cx(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
