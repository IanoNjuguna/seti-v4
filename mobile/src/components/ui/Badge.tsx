import { View } from 'react-native';
import { Text } from './Text';
import { cn } from '@/lib/cn';
import type { BadgeVariant } from '@/types';

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success-bg text-accent-primary',
  neutral: 'bg-surface-inset text-text-secondary',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-alert-bg text-alert',
};

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return (
    <View
      className={cn(
        'rounded-pill px-2 py-1 self-start',
        variantClasses[variant]
      )}
    >
      <Text variant="micro" className={variantClasses[variant]}>
        {children}
      </Text>
    </View>
  );
}
