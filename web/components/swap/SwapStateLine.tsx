'use client';

import { Text } from '@/components/ui';
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
 */
export function SwapStateLine({ tone, sentence }: SwapStateLineProps) {
  const alert = tone === 'alert';

  return (
    <Text
      variant="micro"
      as="p"
      role={alert ? 'alert' : undefined}
      color={alert ? 'alert' : 'secondary'}
    >
      {sentence}
    </Text>
  );
}
