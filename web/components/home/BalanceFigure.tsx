'use client';

import { Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { MaskedAmount } from '@/components/ui/MaskedAmount';
import type { TextVariant } from '@/components/ui/Text.types';
import { useAmountPrivacy } from '@/lib/privacy/amount-privacy.context';
import { AMOUNT_PRIVACY_COPY } from '@/lib/privacy/amount-privacy.constants';
import { formatBalance } from './home.format';
import type { BalanceFigureProps } from './BalanceFigure.types';

/**
 * The balance itself and the control that hides it.
 *
 * ONE figure, and there is deliberately no breakdown under it any more. The account
 * settles into OUSD in the background (the settlement pass), so which token holds
 * the money is housekeeping, not information: a customer who holds KES 4,800 wants
 * to know they hold KES 4,800, and a disclosure listing OUSD, USDC.e and pathUSD
 * turned that answer into a crypto question with four parts.
 *
 * The figure is EXACT and pinned to one line. It used to compact at a million
 * ("KES 4.8M"), which put a rounded figure where spendable money belongs and
 * contradicted the same account's Activity list. The width risk moves to the type
 * instead, and the thresholds are character counts on the PHONE, where the card is
 * narrowest: a 14-character amount holds the display step, a 17-character one steps
 * down once, anything longer steps down again. Rounded is worse than smaller, and
 * wrapping a figure mid-value is worse than both.
 *
 * The control sits beside the label it changes and is labelled by what it will DO.
 * Since #94 it governs more than this card (`MaskedAmount` is used by the period row
 * and every merchant total), so its name says `amounts`, and the flag lives in the
 * app shell rather than here: held in this component it un-hid itself the moment a
 * customer tapped Pay and came back (#135).
 *
 * THE MOTION is the mask's (`MaskedAmount`): 160ms opacity, no movement, no reflow.
 * The glyph swaps on `--duration-instant` underneath, because the eye is a state
 * indicator and the fade of the number is what carries the change.
 */
export function BalanceFigure({ data }: BalanceFigureProps) {
  const { hidden, toggle } = useAmountPrivacy();
  const figure = formatBalance(data?.balance, data?.currency);

  const balanceVariant: TextVariant =
    figure.length <= 14 ? 'balance' : figure.length <= 17 ? 'balance-compact' : 'balance-tight';

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Text variant="micro" as="p" color="inverse-muted">
          <span id="balance-heading">You have</span>
        </Text>

        <div className="mt-2">
          <MaskedAmount hidden={hidden} variant={balanceVariant} color="inverse">
            <Text variant={balanceVariant} tabular as="span" color="inverse" className="whitespace-nowrap">
              {figure}
            </Text>
          </MaskedAmount>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={hidden}
        aria-label={hidden ? AMOUNT_PRIVACY_COPY.show : AMOUNT_PRIVACY_COPY.hide}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-dark-mute transition-colors duration-(--duration-quick) ease-out hover:bg-surface-elevated hover:text-on-dark active:bg-surface-elevated active:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-dark/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-dark"
      >
        <Icon
          name="eye"
          className={`absolute transition-opacity duration-(--duration-instant) ease-out motion-reduce:transition-none ${hidden ? 'opacity-0' : 'opacity-100'}`}
        />
        <Icon
          name="eyeOff"
          className={`absolute transition-opacity duration-(--duration-instant) ease-out motion-reduce:transition-none ${hidden ? 'opacity-100' : 'opacity-0'}`}
        />
      </button>
    </div>
  );
}
