'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReceiptDocument } from '@/lib/api';
import { RECEIPT_ACTION_MESSAGE, RECEIPT_FILE_PREFIX, RECEIPT_STATUS_CLEAR_MS } from './Receipt.constants';
import { downloadReceiptJson, downloadReceiptText, printReceipt, shareReceipt } from './receipt.export';
import { receiptFileName } from './receipt.format';
import type { UseReceiptActionsReturn } from './Receipt.types';

/**
 * The four ways out of a receipt: share it, print it to PDF, or download it as
 * text or JSON.
 *
 * Every one of them is client-side and dependency-free — a Blob download, the
 * browser's own print pipeline, and the platform share sheet with the clipboard
 * as its fallback. Each reports what happened in words the customer can act on,
 * and the confirmation clears itself so the row of buttons goes back to normal.
 *
 * `currency` is the one the card resolved, and it is passed on so the text
 * export renders the card as shown rather than re-deciding the label.
 */
export function useReceiptActions(
  receipt: ReceiptDocument | null,
  currency: string | null,
  shareUrl: string | null
): UseReceiptActionsReturn {
  const [status, setStatus] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const announce = useCallback((message: string | null) => {
    if (!message) return;

    setStatus(message);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(null), RECEIPT_STATUS_CLEAR_MS);
  }, []);

  const share = useCallback(() => {
    if (!receipt) return;
    void shareReceipt(receipt, shareUrl).then((outcome) => announce(RECEIPT_ACTION_MESSAGE[outcome]));
  }, [receipt, shareUrl, announce]);

  const downloadTxt = useCallback(() => {
    if (!receipt) return;
    downloadReceiptText(receipt, currency);
    announce(`Saved ${receiptFileName(receipt, 'txt', RECEIPT_FILE_PREFIX)}`);
  }, [receipt, currency, announce]);

  const downloadJson = useCallback(() => {
    if (!receipt) return;
    downloadReceiptJson(receipt);
    announce(`Saved ${receiptFileName(receipt, 'json', RECEIPT_FILE_PREFIX)}`);
  }, [receipt, announce]);

  // No PDF library: the print stylesheet prints the card and nothing else, and
  // the browser's own "Save as PDF" is the exporter.
  const downloadPdf = useCallback(() => {
    if (receipt) printReceipt();
  }, [receipt]);

  return { share, downloadPdf, downloadTxt, downloadJson, status };
}
