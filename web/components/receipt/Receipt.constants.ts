import type { ShareOutcome } from './Receipt.types';

export const RECEIPT_WORDMARK = 'Seti';

/** The dialog's accessible name points here; one id, shared by the card. */
export const RECEIPT_TITLE_ID = 'receipt-title';

/**
 * Serialised inside the sheet so the two never disagree: the trigger and the
 * document are the same transfer, and a title that named a different one would
 * make an exported file a claim the customer cannot check.
 */
export const RECEIPT_FILE_PREFIX = 'seti-receipt';

/** How long a confirmation stays on screen before it clears itself. */
export const RECEIPT_STATUS_CLEAR_MS = 4000;

/** Members of the dialog's tab order, for wrapping focus back to the start. */
export const RECEIPT_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * The placeholder the backend writes on a payment leg that has no merchant.
 *
 * `backend/src/services/receipt.ts` sets the leg's label to the merchant's own
 * name, or to `Recipient` when the row is between two people. The label is the
 * only name the document carries, so "no name" has to be recognised by this
 * literal — there is no null to test.
 */
export const RECEIPT_GENERIC_PAYEE = 'Recipient';

/** A fee figure the row cannot support is a dash, never a zero. */
export const RECEIPT_MISSING_FIGURE = '—';

/**
 * The two colours a QR code is read by, and its viewBox size.
 *
 * Deliberately literals rather than design tokens: react-qr-code writes these to
 * an SVG presentation attribute (`fill`), which cannot resolve a CSS custom
 * property — a token there would render an unreadable code, not a themed one. A
 * QR's colours are also a machine-readable spec (maximum contrast), not a
 * styling choice; the light field the code sits in is the tile's own
 * `bg-canvas-light` token, which IS part of the surface.
 */
export const RECEIPT_QR_FOREGROUND = 'black';
export const RECEIPT_QR_BACKGROUND = 'white';
export const RECEIPT_QR_SIZE = 144;

export const RECEIPT_COPY = {
  /* The one word above the figure: what the money did, from the customer's side. */
  paid: 'Paid',
  received: 'Received',
  /**
   * The way the figure is introduced when the next line names the token (#238):
   * `in USDT0`. A preposition, not a label — a bare symbol under `KES 500.00`
   * reads as if the two were the same thing, and "from" is only true one way round.
   */
  assetPrefix: 'in',
  /* The other side of the payment, when the document carries no name for them. */
  payeeFallback: 'the recipient',
  payerFallback: 'the sender',
  /* One line, both fees summed — never two figures to add up in two currencies. */
  feesPaid: 'Fees paid',
  feesPaidBySender: 'Fees paid by the sender',
  explorer: 'View on the explorer',
  close: 'Close receipt',
  share: 'Share',
  qrCaption: 'Scan to open this receipt',
  pdf: 'PDF',
  txt: 'TXT',
  json: 'JSON',
  confirmed: 'Confirmed',
  failed: 'Failed',
  /** Prefixed to the network on the card and in every export. */
  networkPrefix: 'Network:',
  loading: 'Loading receipt',
  errorTitle: "Couldn't load this receipt",
  retry: 'Try again',
} as const;

/**
 * What each export tells the customer afterwards. `null` means "say nothing" —
 * a dismissed share sheet is not a failure and does not deserve an error.
 */
export const RECEIPT_ACTION_MESSAGE: Record<ShareOutcome, string | null> = {
  shared: 'Receipt link shared.',
  copied: 'Receipt link copied to your clipboard.',
  failed: "Couldn't share or copy. Open the receipt on the explorer instead.",
  dismissed: null,
};

/**
 * Token symbols as they are written, not as they are stored.
 *
 * The receipt is the one surface that names the token, because it is the
 * mechanical record of what moved on-chain. Every other surface shows a fiat
 * figure, and a balance never names a token at all.
 */
export const RECEIPT_ASSET_NAMES: Record<string, string> = {
  pathusd: 'pathUSD',
  ousd: 'OUSD',
  usdt0: 'USDT0',
  'usdc.e': 'USDC.e',
};
