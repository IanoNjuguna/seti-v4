'use client';

import { Button, Card, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { SWAP_RESULT_COPY } from '@/lib/pay/convert-swap.constants';
import { SwapReference } from './SwapReference';
import { SwapResultFigures } from './SwapResultFigures';
import type { SwapResultProps } from './SwapForm.types';

/**
 * A swap that is finished: signed, verified off the receipt, and recorded (#593).
 *
 * This REPLACES the form rather than sitting under it. The page used to end a successful
 * swap with a grey sentence below a pair of filled-in cards and an armed `Swap now`,
 * which reads as a request nobody finished and invites a second swap the customer did
 * not ask for. A swap that is over has nothing left to edit, so there is nothing left to
 * draw: the figures that were signed, the proof, and one way back to a fresh page.
 *
 * Three rules, copied from `PaySuccess` so the product has one shape for this moment:
 * the money is the hero, the hash is legible and it links, and nothing counts up or
 * replays. The check is `aria-hidden` decoration and the card is the announcement.
 */
export function SwapResult({ result, onDone }: SwapResultProps) {
  return (
    <Card className="space-y-4 text-center" role="status">
      <span
        aria-hidden="true"
        className="check-in mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-accent-light-green"
      >
        <Icon name="check" className="h-6 w-6" />
      </span>

      <Text variant="card-title" as="h2">
        {SWAP_RESULT_COPY.doneTitle}
      </Text>

      <SwapResultFigures quote={result.quote} />

      <SwapReference txHash={result.txHash} network={result.network} />

      <Text variant="micro" color="secondary" as="p">
        {SWAP_RESULT_COPY.doneBody}
      </Text>

      <Button type="button" fullWidth onClick={onDone}>
        {SWAP_RESULT_COPY.finish}
      </Button>
    </Card>
  );
}
