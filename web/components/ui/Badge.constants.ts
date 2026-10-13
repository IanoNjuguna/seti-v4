import type { BadgeVariant } from '@/lib/types';

/**
 * Tags from `design/revolut.md`.
 *
 * The system has no coloured-background badge token — only `surface-soft`
 * neutrals and the reserved `primary` fill — so a tag is a soft pill whose
 * *text* carries the semantic colour, drawn from the doc's Semantic palette:
 * `accent-light-green` (success/positive), `accent-yellow` (caution/pending),
 * `accent-danger` (error). Colour is never the only signal: the label says it.
 */
export const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-surface-soft text-accent-light-green',
  neutral: 'bg-surface-soft text-mute',
  warning: 'bg-surface-soft text-accent-yellow',
  danger: 'bg-surface-soft text-accent-danger',
};
