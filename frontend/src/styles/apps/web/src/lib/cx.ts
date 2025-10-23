import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with tailwind-merge to resolve conflicts
 *
 * Example:
 * cx('px-2 py-1', 'px-4') => 'py-1 px-4'
 * cx('text-red-500', isActive && 'text-blue-500') => 'text-blue-500'
 */
export function cx(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}