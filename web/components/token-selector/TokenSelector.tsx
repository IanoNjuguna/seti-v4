'use client';

import { Skeleton, Text } from '@/components/ui';
import { TOKEN_SELECTOR_COPY } from './TokenSelector.constants';
import { TokenSelectorLine } from './TokenSelectorLine';
import { TokenSelectorOptions } from './TokenSelectorOptions';
import { TokenSelectorRefusal } from './TokenSelectorRefusal';
import { useTokenSelector } from './useTokenSelector';
import type { TokenSelectorProps } from './TokenSelector.types';

/**
 * Which balance pays — ONE component, on send and on pay (#228).
 *
 * Two pickers is how an app grows two mental models of its own money, so the flow
 * that pays a merchant and the flow that sends to a person mount this same control.
 * It decides nothing about the payment: `model` arrives already derived from the
 * quote the server returned (`token-selector.model.ts`), and choosing feeds a token
 * back into that quote, which is what pins the price, the fee line and the signed
 * transfer to the same asset.
 *
 * The three waits are shapes rather than grey text: a bar the height of the line, the
 * sentence for a read that failed, and nothing at all when the account holds nothing
 * (the quote already says what to do about that, and this control would only repeat
 * it).
 */
export function TokenSelector({ model, onChoose }: TokenSelectorProps) {
  const { open, toggle, choose } = useTokenSelector({ onChoose });

  if (model.unavailable) {
    return (
      <Text variant="micro" as="p" color="secondary">
        {TOKEN_SELECTOR_COPY.unavailable}
      </Text>
    );
  }

  if (model.loading) {
    return <Skeleton className="h-14 w-full" />;
  }

  if (model.options.length === 0) return null;

  return (
    <div className="space-y-3">
      <TokenSelectorLine model={model} open={open} onToggle={toggle} />
      {open && model.choosable ? <TokenSelectorOptions model={model} onChoose={choose} /> : null}
      {model.refusal ? <TokenSelectorRefusal refusal={model.refusal} onOffer={choose} /> : null}
    </div>
  );
}
