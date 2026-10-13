'use client';

import { useMemo } from 'react';
import type { ReceiptDocument } from '@/lib/api';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { deriveReceiptCard } from './receipt.card';
import type { ReceiptCard } from './Receipt.types';

/**
 * The card for one document.
 *
 * The row's own currency comes first and the customer's is only a fallback, so
 * an old receipt is still priced in the currency it was written in. Every
 * display figure on the card is derived here, off the render path.
 */
export function useReceiptCard(receipt: ReceiptDocument | null): ReceiptCard | null {
  const rowCurrency =
    receipt === null ? null : receipt.ledger.fiatCurrency ?? receipt.total.fiatCurrency;
  const fallbackCurrency = useUserCurrency(receipt !== null && rowCurrency === null);

  return useMemo(
    () => (receipt === null ? null : deriveReceiptCard(receipt, fallbackCurrency)),
    [receipt, fallbackCurrency]
  );
}
