'use client';

import { Button, Card, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { SWAP_RESULT_COPY } from '@/lib/pay/convert-swap.constants';
import { SwapReference } from './SwapReference';
import type { SwapResultProps } from './SwapForm.types';

/**
 * A swap that happened on chain but was not written down (#593).
 *
 * This is the one ending where the page must NOT offer the button that signs. The money
 * moved and the ledger has no row, so the only useful thing on screen is the hash: it is
 * what finds the swap afterwards. A form left here would re-sign a second real swap for
 * a customer who was told to check their activity later.
 *
 * It is drawn as an alert, not as a success with different words. The swap worked and
 * the RECORD failed, and a green check would tell the customer the opposite of the one
 * thing they need to know.
 */
export function SwapNotRecorded({ result, onDone }: SwapResultProps) {
  return (
    <Card className="space-y-4 text-center" role="alert">
      <span
        aria-hidden="true"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-accent-danger"
      >
        <Icon name="alert" className="h-6 w-6" />
      </span>

      <Text variant="card-title" as="h2">
        {SWAP_RESULT_COPY.unrecordedTitle}
      </Text>

      <Text variant="body" color="secondary" as="p">
        {SWAP_RESULT_COPY.unrecordedBody}
      </Text>

      <SwapReference txHash={result.txHash} network={result.network} />

      <Button type="button" fullWidth onClick={onDone}>
        {SWAP_RESULT_COPY.finish}
      </Button>
    </Card>
  );
}
