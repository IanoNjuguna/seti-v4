import { cn } from '@/lib/cn';

export interface SkeletonProps {
  className?: string;
}

/**
 * Loading placeholder. Callers size it to the shape it stands in for, so the
 * layout does not jump when real content arrives (DESIGN.md §7).
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-md bg-surface-soft', className)}
    />
  );
}
