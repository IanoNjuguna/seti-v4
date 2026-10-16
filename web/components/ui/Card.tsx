import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Internal padding steps, straight off `design/revolut.md` §Spacing:
 *
 *  - `md` — `spacing.xxl` (32px, `p-8`). The documented feature-card inset, and
 *    the default, so every existing caller renders exactly as before.
 *  - `sm` — `spacing.xl` (24px, `p-6`). The one step down, for the home and
 *    activity surfaces, where 32px on both sides ate 64px of a 320px phone
 *    column.
 *
 * This is a *variant* and not a `className` escape hatch on purpose. `cn()` in
 * `web/lib/cn.ts` is a plain join, not `twMerge`: a caller's `p-6` is emitted
 * alongside the baked `p-8`, and Tailwind's own ordering decides — the
 * later-emitted base utility wins, so the caller's class silently does nothing.
 * A variant is the only way a caller can change a base inset. (Tailwind emits
 * variants *after* base utilities, so a breakpoint like `sm:p-8` would beat a
 * base `p-8`; a base override would not.)
 */
export type CardPadding = 'md' | 'sm';

const PADDING_CLASSES: Record<CardPadding, string> = {
  md: 'p-8',
  sm: 'p-6',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inset wells use `surface-soft` (the doc's inset groups inside white bands). */
  inset?: boolean;
  /** Internal padding. `md` (32px, `spacing.xxl`) is the system default; `sm` (24px, `spacing.xl`) is the phone step for the home/activity cards. */
  padding?: CardPadding;
}

/**
 * `feature-card-light` from `design/revolut.md`: white on the white canvas, 1px
 * `hairline-light`, `rounded-md` (12px), `spacing.xxl` (32px) padding.
 *
 * No shadow, deliberately — the system has no drop-shadow language, so depth is
 * the hairline plus the canvas/soft colour blocking.
 */
export function Card({ inset = false, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-md',
        PADDING_CLASSES[padding],
        inset ? 'bg-surface-soft' : 'bg-surface-card border border-hairline-light',
        className
      )}
    />
  );
}
