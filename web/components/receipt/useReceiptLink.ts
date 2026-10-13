'use client';

import { useEffect, useState } from 'react';
import { mintReceiptLink } from '@/lib/api';
import type { UseReceiptLinkReturn } from './Receipt.types';

/**
 * The owner's shareable link, minted once as the sheet opens.
 *
 * Minting is a write (it creates a capability), so it happens when the owner has
 * actually opened the receipt — not on every Activity row. The link lives 24h and
 * the sheet is short-lived, so one mint per open is right; re-opening mints a
 * fresh one rather than resurrecting a token that may already have aged out.
 *
 * The backend answers with a PATH and the browser owns its own origin, so the
 * absolute link is composed here. `null` is a handled state, not an error state:
 * a receipt the owner cannot share (minting failed) is still a receipt, and the
 * card simply carries no QR.
 */
export function useReceiptLink(transactionId: string): UseReceiptLinkReturn {
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    mintReceiptLink(transactionId)
      .then((link) => {
        if (!active) return;
        setShareUrl(new URL(link.path, window.location.origin).toString());
      })
      .catch(() => {
        if (active) setShareUrl(null);
      });

    return () => {
      active = false;
    };
  }, [transactionId]);

  return { shareUrl };
}
