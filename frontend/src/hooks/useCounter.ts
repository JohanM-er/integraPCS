import { useState } from 'react';

export interface UseCounterReturn {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

/**
 * Simple counter hook for demonstration purposes
 * @param initialValue - Starting count value (default: 0)
 */
export function useCounter(initialValue = 0): UseCounterReturn {
  const [count, setCount] = useState(initialValue);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);

  return { count, increment, decrement, reset };
}
