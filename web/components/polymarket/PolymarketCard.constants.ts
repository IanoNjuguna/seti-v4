/**
 * Every string the Polymarket card prints (#599).
 *
 * Kept beside the component for the reason the repo keeps copy out of JSX: a sentence is a
 * claim, and a claim that lives in a markup tree is a claim nobody can diff. None of these
 * name a stablecoin, because the card speaks in the customer's currency — the figures it
 * shows arrive already converted, at the rate it also prints.
 *
 * No em dashes and no arrows: this copy is read by a customer, not by a developer.
 */
export const POLYMARKET_CARD_COPY = {
  eyebrow: 'Polymarket',
  unlinkedTitle: 'See what you hold on Polymarket',
  unlinkedLede: 'Paste your Polymarket wallet address. Seti reads it and never touches it.',
  addressLabel: 'Polymarket wallet address',
  addressPlaceholder: '0x…',
  linkAction: 'Show positions',
  linking: 'Reading…',
  emptyTitle: 'No open positions',
  emptyLede: 'This wallet holds nothing right now. Anything you enter will show up here.',
  retry: 'Try again',
  change: 'Use a different address',
  failedTitle: 'Polymarket could not be read',
  totalLabel: 'Total value',
  /** `rate` is the figure the server converted at, so the subline can never drift. */
  rateLine: (rate: string, currency: string) => `at ${currency} ${rate} per dollar`,
  staleRate: 'This is the last rate the publisher gave us.',
  redeemable: (count: number) =>
    count === 1 ? '1 position is ready to redeem on Polymarket' : `${count} positions are ready to redeem on Polymarket`,
} as const;

/**
 * One sentence per refusal code, and the reason each exists.
 *
 * A retired version is not an outage: it needs a deploy, and a retry will not help. An
 * unavailable upstream is worth a retry. A payload we cannot read is our bug, and the
 * customer can do nothing about it. Saying all three the same way is the defect this map
 * removes, and none of them may be rendered as a zero, which is why the failed state has no
 * figure at all.
 */
export const POLYMARKET_REFUSAL_COPY: Record<string, string> = {
  'polymarket-retired': 'Seti needs an update before it can read Polymarket again.',
  'polymarket-unavailable': 'Polymarket is not answering right now. Nothing on your account has changed.',
  'polymarket-payload': 'Polymarket sent something Seti could not read. We have logged it.',
  'polymarket-address-invalid': 'That is not a wallet address. Paste the one from your Polymarket profile.',
};
