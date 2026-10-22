import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a fast-changing value.
 *
 * @template T
 * @param {T} value - The input value to debounce
 * @param {number} [delay=300] - Debounce delay in milliseconds
 * @returns {T} - Debounced value
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
