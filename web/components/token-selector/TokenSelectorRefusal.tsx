import { Button, Text } from '@/components/ui';
import { TOKEN_SELECTOR_COPY } from './TokenSelector.constants';
import type { TokenRefusal } from './TokenSelector.types';

export interface TokenSelectorRefusalProps {
  refusal: TokenRefusal;
  onOffer: (asset: string) => void;
}

/**
 * #223's refusal, where it becomes actionable (#228).
 *
 * The sentence is the ONE the refusal code owns — `refusalMessageFor` maps the code
 * to our copy — so this component cannot drift from what the server actually
 * refused, and nothing here is written twice anywhere else.
 *
 * The offer is a BUTTON and not a link away from the payment: the refusal means the
 * pinned balance is short while another is not, so the way out is one tap at the
 * same amount, priced again for the token that can pay. Nothing is signed until that
 * token's own quote comes back.
 *
 * When no single balance covers, `offer` is null — switching tokens would only
 * produce the same refusal, so the sentence is shown and the wrong next step is not.
 */
export function TokenSelectorRefusal({ refusal, onOffer }: TokenSelectorRefusalProps) {
  const { sentence, offer } = refusal;

  return (
    <div className="space-y-3 rounded-md bg-surface-soft p-3" role="status">
      <Text variant="micro" as="p" color="alert">
        {sentence}
      </Text>

      {offer ? (
        <Button variant="secondary" fullWidth onClick={() => onOffer(offer.asset)}>
          {TOKEN_SELECTOR_COPY.offer(offer.symbol)}
        </Button>
      ) : null}
    </div>
  );
}
