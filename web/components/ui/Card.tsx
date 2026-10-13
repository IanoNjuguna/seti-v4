import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inset wells use `surface-soft` (the doc's inset groups inside white bands). */
  inset?: boolean;
}

/**
 * `feature-card-light` from `design/revolut.md`: white on the white canvas, 1px
 * `hairline-light`, `rounded-lg` (20px), `spacing.xxl` (32px) padding.
 *
 * No shadow, deliberately — the system has no drop-shadow language, so depth is
 * the hairline plus the canvas/soft colour blocking.
 */
export function Card({ inset = false, className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-lg p-8',
        inset ? 'bg-surface-soft' : 'bg-surface-card border border-hairline-light',
        className
      )}
    />
  );
}
