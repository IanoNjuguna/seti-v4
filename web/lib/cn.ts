/**
 * Join Tailwind classes.
 *
 * Deliberately dependency-free: `web/` ships only next/react/react-dom, and the
 * mobile app's `cn` wraps `clsx` for features (object/array inputs) that no
 * screen in this port uses. Adding a package to the gate for a one-line join
 * is not worth the install, so this covers the strings-and-conditionals case
 * and documents what it does not accept.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter((value): value is string => Boolean(value)).join(' ');
}
