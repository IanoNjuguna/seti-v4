import { cn } from '@/lib/cn';
import { Text } from './Text';
import { TEXT_COLOR } from './Badge.constants';
import type { BadgeProps } from './Badge.types';

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full bg-surface-soft px-3 py-1', className)}>
      <Text as="span" variant="micro" color={TEXT_COLOR[variant]}>
        {children}
      </Text>
    </span>
  );
}
