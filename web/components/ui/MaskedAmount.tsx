import { cn } from '@/lib/cn';
import { AMOUNT_MASK, AMOUNT_MASK_LABEL } from '@/lib/privacy/amount-privacy.constants';
import { Text } from './Text';
import type { MaskAlign, MaskedAmountProps } from './MaskedAmount.types';

/**
 * A money figure that can be masked, without the line it sits on moving.
 *
 * Both the figure and the mask are always in the DOM, stacked: the mask is absolutely
 * positioned over the figure's own box, so the element keeps the figure's width and
 * height while hidden. That is the whole point — a cross-fade between two elements
 * that share one box cannot shift the card, the row, or the amount's right edge, and
 * the page does not jump when the eye is tapped.
 *
 * MOTION IS OPACITY ONLY, at `--duration-quick` (160ms) with `--ease-out`. Nothing
 * slides and nothing scales: the change being explained is "this value is no longer
 * shown", and movement would dress it as an event. `motion-reduce` swaps instantly.
 *
 * The mask is `role="img"` with an accessible name, because six bullets are otherwise
 * read out one by one. The figure behind it is `aria-hidden` while hidden, so the real
 * amount never reaches the accessibility tree in that state.
 */
const FADE =
  'transition-opacity duration-(--duration-quick) ease-out motion-reduce:transition-none';

export function MaskedAmount({
  hidden,
  variant = 'body',
  color,
  align = 'start',
  children,
}: MaskedAmountProps) {
  return (
    <span className="relative inline-block">
      <span aria-hidden={hidden} className={cn(FADE, hidden && 'opacity-0')}>
        {children}
      </span>

      <span
        role="img"
        aria-label={AMOUNT_MASK_LABEL}
        aria-hidden={!hidden}
        className={cn(
          FADE,
          'absolute inset-0 flex items-center',
          align === 'end' ? 'justify-end' : 'justify-start',
          hidden ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      >
        <Text variant={variant} color={color} tabular>
          {AMOUNT_MASK}
        </Text>
      </span>
    </span>
  );
}
