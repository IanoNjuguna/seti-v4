import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

interface CardProps extends ViewProps {
  inset?: boolean;
}

export function Card({ inset = false, className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-card p-4',
        inset ? 'bg-surface-inset' : 'bg-surface-card border border-border-1 shadow-ambient',
        className
      )}
      {...props}
    />
  );
}
