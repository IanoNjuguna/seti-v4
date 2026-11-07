'use client';

import { Text } from '@/components/ui';
import { SwapReference } from './SwapReference';
import type { SwapStateLineProps } from './SwapForm.types';

/**
 * ONE line about where the swap stands, in one tone at a time.
 *
 * The tone is decided where the sentence is (`useSwapForm`): a sentence about money that
 * may have moved is an alert, and a sentence about what the page is doing is not. That is
 * why the colour is a prop rather than a class the caller passes, and why the alert is
 * also the role: colour alone must never be the only signal (design-enforcement).
 *
 * The sentences are never the server's text. A refusal's code is mapped to our own
 * sentence in `refusal.constants.ts`, so nothing here can render a database's vocabulary.
 *
 * `reference` is not decoration beside the sentence: the one sentence that tells a customer
 * to keep this reference is only obeyable because this renders one (#413). Every other line
 * passes null and draws nothing.
 */
export function SwapStateLine({ tone, sentence, reference }: SwapStateLineProps) {
  const alert = tone === 'alert';

  return (
    <div className="flex flex-col gap-2">
      <Text
        variant="micro"
        as="p"
        role={alert ? 'alert' : undefined}
        color={alert ? 'alert' : 'secondary'}
      >
        {sentence}
      </Text>

      {reference !== null && (
        <SwapReference txHash={reference.txHash} network={reference.network} />
      )}
    </div>
  );
}
