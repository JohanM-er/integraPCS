import { twMerge } from 'tailwind-merge';
import { type ClassValue, clsx } from 'clsx';

/**
 * Merge class names with tailwind-merge to resolve conflicts
 *
 * Example:
 * ```tsx
 * cx('px-2 py-1', 'px-4') => 'py-1 px-4' (px-2 is removed)
 * cx('text-red-500', isActive && 'text-blue-500') => 'text-blue-500'
 * ```
 *
 * @param inputs - Class names to merge
 * @returns Merged class string
 */
export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
