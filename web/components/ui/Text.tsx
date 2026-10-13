import { cn } from '@/lib/cn';
import { COLOR_CLASSES, VARIANT_CLASSES } from './Text.constants';
import type { TextProps } from './Text.types';

export function Text({
  variant = 'body',
  color,
  tabular = false,
  className,
  children,
  id,
  as: Element = 'span',
}: TextProps) {
  return (
    <Element
      id={id}
      className={cn(
        VARIANT_CLASSES[variant],
        color && COLOR_CLASSES[color],
        tabular && 'font-tabular',
        className
      )}
    >
      {children}
    </Element>
  );
}
