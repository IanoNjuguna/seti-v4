import { cn } from '@/lib/cn';
import { COLOR_CLASSES, DEFAULT_COLOR_CLASSES, VARIANT_CLASSES } from './Text.constants';
import type { TextProps } from './Text.types';

export function Text({
  variant = 'body',
  color,
  tabular = false,
  className,
  children,
  id,
  role,
  as: Element = 'span',
}: TextProps) {
  /**
   * Exactly one colour class, always: the caller's `color` when given, otherwise
   * the variant's own. Because the variant no longer carries a colour itself,
   * these two can never both be emitted — so the colour is decided here, not by
   * the order Tailwind happens to emit utilities in. See `Text.constants.ts`.
   */
  const colorClass = color ? COLOR_CLASSES[color] : DEFAULT_COLOR_CLASSES[variant];

  return (
    <Element
      id={id}
      role={role}
      className={cn(VARIANT_CLASSES[variant], colorClass, tabular && 'font-tabular', className)}
    >
      {children}
    </Element>
  );
}
