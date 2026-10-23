import { Text } from '@/components/ui';
import { PAYER_COPY } from './PayPublic.constants';
import type { PayPayerBlockedProps } from './PayPayer.types';

/**
 * No wallet at all: the state that draws no payment prompt.
 *
 * There is no code here and no copyable request, because a prompt a payer cannot
 * answer is the page looking broken at the exact moment they were willing to pay.
 * What is left is honest: the fact, the one thing they can do instead (ask the person
 * who sent the link), and the one promise the page can keep (the link survives, so a
 * wallet later is not a lost payment).
 *
 * No wallet is offered. Creating one is out of scope for #153, and an invitation to
 * sign up would put a payer in a new, empty wallet with no dollars and no way to get
 * any from here, which is the same dead end one tap further in.
 */
export function PayPayerBlocked({ openUntil }: PayPayerBlockedProps) {
  return (
    <div className="space-y-2">
      <Text variant="body" as="p">
        {PAYER_COPY.noneLine}
      </Text>
      <Text variant="body" color="secondary" as="p">
        {PAYER_COPY.noneNext}
      </Text>
      <Text variant="micro" as="p">
        {PAYER_COPY.noneKeep(openUntil)}
      </Text>
    </div>
  );
}
