import { formatFiat } from '@/lib/formatCurrency';

/**
 * The dashboard's `balance`, in the currency the dashboard says it is in.
 *
 * The payload carries both the figure and `currency`, and both are used: rendering
 * a balance with a currency label chosen here rather than given would be a money
 * claim made in the UI, which is how a KES label ended up on amounts that were not
 * KES.
 */
export function formatBalance(balance: string | undefined, currency?: string): string {
  const value = Number(balance ?? 0);

  // No currency named, no currency claimed: a balance whose unit we were not told
  // renders as a bare number. Labelling it with a guess would be the same class of
  // money claim this function was fixed for.
  if (!currency) {
    return new Intl.NumberFormat('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  // Compact at the top end. A nine-figure balance cannot fit a phone-width hero at
  // display size — it wraps mid-number — and nobody reads the last six digits of a
  // large balance anyway. Below a million it still renders exactly.
  if (Math.abs(value) >= 1_000_000_000) return `${currency} ${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(1)}M`;

  return formatFiat(value, currency);
}

/** `monthToDateDelta` is a ratio, not a percentage: 0.12 renders as 12%. */
export function formatDelta(delta: number): string {
  return `${delta > 0 ? '↑' : '↓'} ${(Math.abs(delta) * 100).toFixed(1)}% this month`;
}

/**
 * Shorten an address for display: `0x1234…abcd`.
 *
 * Only for prose. Never build a transfer from this — the full address is the
 * only thing that may be signed, and `validate-transfer.ts` returns the
 * checksummed form for that.
 */
export function formatAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
