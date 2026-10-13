import { formatFiat } from '@/lib/formatCurrency';
import { RECEIPT_ASSET_NAMES } from './Receipt.constants';

/**
 * `0x0d7c8f…5332` — the first and last characters, which is what an eye matches on.
 *
 * Every shortened value keeps the FULL string in the `title` attribute: the
 * abbreviation is for reading, never the only copy of the value.
 */
export function shortenValue(value: string): string {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

/** The symbol as it is written (`pathUSD`), not as it is stored (`pathusd`). */
export function assetName(asset: string): string {
  return RECEIPT_ASSET_NAMES[asset.toLowerCase()] ?? asset.toUpperCase();
}

/**
 * The mechanical, on-chain figure: `10,000.00 pathUSD`.
 *
 * Decimals come from the amount itself rather than a fixed two, because gas is
 * genuinely six figures of a token — rounding `0.000027` to `0.00` would show a
 * fee of nothing.
 */
export function formatAssetAmount(amount: string, asset: string): string {
  const value = Number(amount);
  const figures = Number.isFinite(value)
    ? new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value)
    : amount;

  return `${figures} ${assetName(asset)}`;
}

/**
 * A fiat figure, or null when there is no currency to label it with.
 *
 * Null rather than a guess: a row written before the currency was stored cannot
 * be labelled with one, and a mislabelled amount is a money claim. `formatFiat`
 * owns the per-currency decimals and the sub-unit rule.
 */
export function formatFiatValue(amount: number, currency: string | null): string | null {
  if (currency === null || !Number.isFinite(amount)) return null;
  return formatFiat(amount, currency);
}

/**
 * `13 October 2026 at 14:32` — the block's own instant, on one line.
 *
 * Only ever called on the client: the card is rendered after a click, so no
 * server clock formats it and nobody hydrates a different timezone's string.
 */
export function formatReceiptDateTime(iso: string): string {
  const at = new Date(iso);
  const date = at.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = at.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  return `${date} at ${time}`;
}

/**
 * A name that identifies the transfer on its own: the same row exported twice
 * overwrites itself rather than piling up, and two receipts never collide.
 */
export function receiptFileName(receipt: { hash: string }, extension: string, prefix: string): string {
  return `${prefix}-${receipt.hash.slice(2, 10)}.${extension}`;
}
