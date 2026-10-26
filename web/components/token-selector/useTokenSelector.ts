'use client';

import { useCallback, useState } from 'react';
import type { UseTokenSelectorReturn } from './TokenSelector.types';

/**
 * The selector's own state: whether the rows are open, and what choosing one does.
 *
 * Nothing about WHICH token pays lives here — that is a payment input, it changes
 * what the server prices and what gets signed, so it belongs to `usePayMerchant`
 * and arrives back as `model.paying`. This hook cannot disagree with the quote.
 *
 * Choosing closes the list: the row was the question, and leaving it open over a
 * payment the customer is about to confirm makes the next tap ambiguous.
 */
export function useTokenSelector({
  onChoose,
}: {
  onChoose: (asset: string | null) => void;
}): UseTokenSelectorReturn {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((wasOpen) => !wasOpen), []);

  const choose = useCallback(
    (asset: string) => {
      setOpen(false);
      onChoose(asset);
    },
    [onChoose]
  );

  return { open, toggle, choose };
}
