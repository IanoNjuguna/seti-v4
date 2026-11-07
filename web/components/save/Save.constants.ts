/**
 * Every word the Save screen renders.
 *
 * Shaped by Cash App's own savings page, because that is the page this is modelled
 * on: one figure, what it earns, two actions — `Add money` / `Withdraw`. Their four
 * promises translate to three we can keep and one we must not fake:
 *
 *   "Earn interest"                 → the rate when the vault publishes one, and a
 *                                    plain "unavailable" when it does not;
 *   "Start with as little as $1"    → there is no minimum here, so we claim none;
 *   "Transfer from savings anytime" → true only if the vault redeems synchronously,
 *                                     which the withdraw slice checks rather than
 *                                     promising in copy;
 *   "No separate account"           → ours is stronger: you still own it.
 */
export const SAVE_COPY = {
  title: 'Save',
  savedLabel: 'Saved',
  availableLabel: 'Available',
  /**
   * Below the figure, with nothing saved: what this place IS, and nothing it cannot
   * back. It read "Money you set aside earns interest. You can take it out any time."
   * until #137 measured both halves: `apy.net` is 0.000000 and `instantLiquidity` is
   * null on every Earn vault including ours, so the sentence promised a rate we do not
   * pay and a withdrawal the vault has never proven. What is left is the part that is
   * true on chain: the position is in the customer's own name.
   */
  empty: 'Money you set aside goes into a Tempo vault in your own name.',
  rateUnavailable: 'Rate unavailable right now',
  /**
   * THE RATE IS ZERO, which is not the same as unavailable. The vault publishes `apy.net
   * 0.000000`; "unavailable" was the copy for a failed read (#137), and printing a bare
   * `0.00` leaves the customer to guess whether that is the rate or a broken screen. Neither
   * is the sentence; this is.
   */
  rateZero: 'The vault pays no rate right now',
  /**
   * The campaign's rate, and the two facts that make it honest (#426): WHO pays it and WHEN it
   * stops. It leads the card because it is the number a customer is choosing on, and it always
   * carries its own end date, so "3.60%" is never read as the vault's.
   */
  campaignRateLine: (apr: string, ends: string) => `${apr}% campaign rewards, ends ${ends}`,
  /** The vault's own rate, right under the campaign's. Quieter, never the lead. */
  vaultRateLine: (apy: string) => `The vault itself pays ${apy}%`,
  /** When no campaign is live, the vault's rate is the only one there is. */
  vaultOnlyLine: (apy: string) => `The vault pays ${apy}%`,
  earnedLabel: 'Earned so far',
  earnedUnknown: 'Earnings not measurable yet',
  addAction: 'Add money',
  withdrawAction: 'Withdraw',
  /** The claim, named as a campaign reward so it is never read as a vault rate. */
  claimAction: 'Claim rewards',
  withdrawUnavailable: 'Nothing saved yet',
  amountTitle: 'How much are you saving?',
  amountLabel: 'Amount to save',
  amountPlaceholder: '0.00',
  amountInputId: 'save-amount',
  amountHint: 'From your available balance.',
  /** No earning claim here either: the swap is a fact, "starts earning" is a rate. */
  amountNote: 'Swapped into the vault, in your own name.',
  amountButton: 'Add to savings',
  withdrawTitle: 'How much are you taking out?',
  withdrawLabel: 'Amount to withdraw',
  withdrawInputId: 'save-withdraw-amount',
  withdrawHint: 'Up to what you have saved.',
  withdrawNote: 'Cashed out of the vault and swapped back to your available balance.',
  withdrawButton: 'Take out',
  withdrawOverSaved: 'That is more than you have saved.',
  withdrawn: 'Withdrawn',
  withdrawnBody: 'It is back in your available balance, ready to spend.',
  cancel: 'Cancel',
  paused: 'Savings are paused right now. Nothing can be added.',
  deposited: 'Saved',
  /** No "and you can withdraw it any time": withdrawability is the vault's to prove. */
  depositedBody: 'It is in the vault in your own name.',
  done: 'Done',
  /* The closed state. Shown while deposits are off (#137): no button, no date, and
     no promise about a rate that currently reads 0.000000. */
  soonLabel: 'Coming soon',
  soonHeadline: 'Saving is not open yet',
  soonBody:
    'Put money aside and earn on it, once the vault pays a rate worth your time. We will turn it on then.',
  soonNote: 'Nothing here can hold your money in the meantime.',
  /**
   * The claim block (#322), and the ONE place the campaign's operator is named (#426).
   *
   * "The campaign" was a name that named nobody: a customer was told to claim rewards from a
   * party the app never identified, and the claim they sign is a call on Merkl's Distributor for
   * Merkl-wrapped OUSD. Naming it here, where the claim happens, is what makes the rate above
   * checkable; naming it in the rate line as well would spend that line on a vendor.
   */
  rewardsLabel: 'Campaign rewards · Merkl',
  /** The date is the promise: the rate belongs to the campaign, not to the vault. */
  rewardsEnds: 'ends',
  rewardsClaimed: 'Claimed. The rewards are in your wallet.',
  /** The custody sentence: the thing a customer most wants to know. */
  custodyNote: 'Your money sits in a Tempo vault in your own name. Seti never holds it.',
} as const;

/** What a customer with no account sees. */
export const SAVE_SIGNED_OUT_COPY = {
  title: 'Sign in to save',
  body: 'Money in savings comes out of your own balance.',
} as const;

/**
 * The one line under the saved figure, decided from the rate itself.
 *
 * THREE ANSWERS, NOT TWO, because the vault can say three different things and the
 * screen used to collapse two of them (#137):
 *
 *  - `null` is a read that failed or an offer with no rate on it: "unavailable".
 *  - a rate above zero is the rate, as the vault published it.
 *  - zero is a RATE, not a fault: the vault publishes `apy.net 0.000000` and printing a
 *    bare `0.00` invites the customer to read it as a broken screen.
 *
 * Parsed rather than string-matched, because the API's figure may arrive as `0.00`,
 * `0.000000` or `0.00%` and all three mean the same thing to a customer.
 */
export function rateLine(apy: string | null): string {
  if (apy === null || apy.trim() === '') return SAVE_COPY.rateUnavailable;
  const value = Number.parseFloat(apy.replace('%', ''));
  if (!Number.isFinite(value)) return SAVE_COPY.rateUnavailable;
  return value > 0 ? apy : SAVE_COPY.rateZero;
}

/**
 * The two rate lines the card shows, and which one is ink (#426).
 *
 * The ordering is the whole argument: the CAMPAIGN's number is the one a customer is choosing
 * on, so it leads, and it names its payer and its end date in the same breath. The vault's own
 * rate follows, quieter, because a 3.6% promotion on a vault that pays 0.0001% is the number
 * that matters the moment the promotion stops.
 *
 * When no campaign is live the vault line is all there is, and it stands alone. When neither
 * can be read the sentence says so rather than printing a zero: "unavailable" is a failed
 * read, "pays no rate" is a measurement, and neither may stand in for the other.
 */
export function rateLines(
  campaign: { apr: string; endsAt: string } | null,
  apy: string | null
): { primary: string; secondary: string | null } {
  const vaultPercent = apy === null ? null : Number.parseFloat(apy);
  const vaultRate = vaultPercent === null || !Number.isFinite(vaultPercent) ? null : vaultPercent;

  if (campaign) {
    return {
      primary: SAVE_COPY.campaignRateLine(campaign.apr, campaign.endsAt),
      secondary:
        vaultRate === null
          ? null
          : vaultRate > 0
            ? SAVE_COPY.vaultRateLine(apy as string)
            : SAVE_COPY.rateZero,
    };
  }

  if (vaultRate === null) return { primary: SAVE_COPY.rateUnavailable, secondary: null };
  return {
    primary: vaultRate > 0 ? SAVE_COPY.vaultOnlyLine(apy as string) : SAVE_COPY.rateZero,
    secondary: null,
  };
}
