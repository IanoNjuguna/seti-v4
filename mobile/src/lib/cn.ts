import { type ClassValue, clsx } from 'clsx';

/**
 * Join Tailwind classes. Uses clsx for conditional joining.
 * NativeWind utilities (e.g. font-tabular) are plain classes, so merging
 * beyond clsx is not required here.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
