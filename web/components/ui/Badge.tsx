import { cn } from '@/lib/cn';
import { Text } from './Text';
import { VARIANT_CLASSES } from './Badge.constants';
import type { BadgeProps } from './Badge.types';

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <Text as="span" variant="micro">
        {children}
      </Text>
    </span>
  );
}
