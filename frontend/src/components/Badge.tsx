import { forwardRef } from 'react';

import { cx } from '@/lib/cx';
import { badgeVariants, type BadgeVariants } from '@/lib/cva';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, BadgeVariants {
  children: React.ReactNode;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant, size, className, children, ...props }, ref) => {
    return (
      <span ref={ref} className={cx(badgeVariants({ variant, size }), className)} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
