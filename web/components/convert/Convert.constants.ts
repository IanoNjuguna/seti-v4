import type { SupportedAsset } from '@/lib/chain';
import { TEMPO_ASSETS } from '@/lib/chain';

/**
 * Every word the convert page renders.
 *
 * The page is ONE screen: the pair, the amount, what arrives, and the button that
 * signs. So the copy carries the figures and nothing else — no sentence explaining
 * what a convert is, because the two rows already say "you give this, you get
 * that", and a customer read one of those before they read anything else.
 *
 * `floor` is the only sentence doing real work: a convert is priced against a
 * moving book, so the figure they see is what the book says NOW and the floor is
 * what the signature guarantees. Saying "at least" once is the honest version.
 */
export const CONVERT_COPY = {
  title: 'Convert',
  giveLabel: 'You give',
  getLabel: 'You get',
  amountPlaceholder: '0.00',
  amountInputId: 'convert-amount',
  receivedInputId: 'convert-received',
  sourceSelectLabel: 'Asset you convert from',
  targetSelectLabel: 'Asset you receive',
  flipLabel: 'Swap the two assets',
  empty: 'Enter an amount to see what you get.',
  quoting: 'Pricing…',
  noBalance: 'That is more than you hold, together with the network fee.',
  /**
   * Rendered under the receive row, where the token figure belongs. The fee
   * sentence below the well already says there is no fee, and saying it twice on a
   * screen this short is the kind of repetition that reads as two conditions.
   */
  floorTemplate: 'At least {floor} {symbol}.',
  /** `{fee}` already carries the currency code (`KES 2.10`). */
  feeTemplate: 'No fee. Network fee about {fee}.',
  action: 'Convert',
  submitting: 'Converting…',
  doneTitle: 'Converted',
  doneBodyTemplate: 'You now hold {amount} {symbol} instead.',
  again: 'Convert again',
  viewActivity: 'See it in Activity',
} as const;

/** The symbol a person reads for a ledger label (`usdc.e` → `USDC.e`). */
export function convertSymbol(asset: SupportedAsset): string {
  return TEMPO_ASSETS.find((entry) => entry.asset === asset)?.symbol ?? asset;
}

/**
 * A token figure as a person reads it: two decimals, thousands separated.
 *
 * Six decimals on a page with two amounts stacked is noise — `9.99000000` and
 * `9.99` are the same promise — and every asset here is dollar-denominated, so
 * two decimals is the precision anyone acts on. The signed figures are untouched:
 * this formats for display only.
 */
/** A bare figure, thousands-separated. The currency is a chip on the field. */
export function formatFigure(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatToken(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * What the page says to someone with no account.
 *
 * It names the reason rather than the mechanism: converting moves stablecoins out
 * of a wallet, so there has to be one. No sentence about signing in "to continue".
 */
export const CONVERT_SIGNED_OUT_COPY = {
  title: 'Sign in to convert',
  body: 'Converting moves money out of your own wallet.',
} as const;
