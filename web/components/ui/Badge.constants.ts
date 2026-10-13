import type { TextColor } from './Text.types';
import type { BadgeVariant } from '@/lib/types';

/**
 * Tags from `design/revolut.md`.
 *
 * The system has no coloured-background badge token — only `surface-soft`
 * neutrals — so a tag is a soft pill whose *text* carries the semantic colour,
 * drawn from the doc's Semantic palette: `accent-light-green` (success/positive),
 * `accent-yellow` (caution/pending), `accent-danger` (error). Colour is never the
 * only signal: the label says it.
 *
 * The colour is a role on the label `Text`, not a class on the pill's wrapper.
 * It used to be a bare `text-*` class on the wrapper, which never applied: the
 * label `Text` baked its own `text-stone`, and a child's colour beats an
 * inherited one, so every badge — success and danger alike — read grey. Naming
 * the role on the text is what actually paints it.
 */
export const TEXT_COLOR: Record<BadgeVariant, TextColor> = {
  success: 'success',
  neutral: 'secondary',
  warning: 'warning',
  danger: 'alert',
};
