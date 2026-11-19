/**
 * What the swap control says, in one place.
 *
 * Two rules hold these sentences together.
 *
 *  1. **Nothing claims more than it knows.** The confirm line says what the customer
 *     gets at LEAST, because the floor is what gets signed; the swap can pay more and
 *     never less. A sentence that promised the quote would be a promise the chain is
 *     allowed to miss by the tolerance.
 *  2. **"Nothing moved" is stated, or it is not claimed.** A failure before the
 *     signature says nothing moved, because nothing did. A failure AFTER it says the
 *     swap went through on chain and the record did not, because that is what happened
 *     and the money is gone either way. Telling a customer "nothing was sent" when a
 *     transfer is on chain and mined is the worst sentence in a money app.
 *
 * Second person, no exclamation, no em dash — the same voice as every refusal
 * (`lib/api/refusal.constants.ts`), and `check:convert-swap` holds these to it.
 */
export const SWAP_COPY = {
  /** The row action. One word, because the row is one line. */
  action: 'Swap',
  /** The confirm control. */
  confirm: 'Swap now',
  /** Backing out, without blame. */
  cancel: 'Not now',

  /** The confirm's two lines. Both figures are the server's, never recomputed. */
  getAtLeast: 'You get at least',
  networkFee: 'Network fee',

  /**
   * The book moved between the quote the customer tapped and the one that would be
   * signed. The new figure is shown; nothing is signed against the old one.
   */
  moved: 'The price moved before you confirmed. Check the new figure before you swap.',

  /**
   * Signed and mined, but the ledger write was refused. The hash is shown beside this
   * line: it is the only thing that can find the money afterwards.
   */
  recordFailed:
    'Your swap went through on-chain, but Seti could not record it. Keep this reference and try again later.',

  /** The wallet declined, or could not sign. Nothing left the account. */
  cancelled: 'Swap cancelled. Nothing moved.',
  failed: 'The swap did not go through. Nothing moved.',
  /** The token's own refusal: the balance cannot cover the amount plus the fee. */
  insufficientFunds: 'This balance cannot cover the swap. Nothing moved.',
  insufficientGas: 'This balance cannot cover the network fee as well. Nothing moved.',
  /** The quote itself failed, before anything was signed. */
  notPriced: 'Seti could not price this swap. Try again in a moment.',
} as const;

/**
 * The words of a swap that is OVER (#593).
 *
 * The page used to end a successful swap with a grey sentence under a still-armed form,
 * which is the shape of a request nobody finished. These are the words of the view that
 * replaces it, and they are held to the same two rules as `SWAP_COPY`: nothing claims
 * more than the receipt proves, and "nothing moved" is only said where nothing did.
 *
 * The two endings are not the same sentence with a different colour. A recorded swap
 * tells the customer where the row is. An unrecorded one tells them the money moved and
 * the record did not, because that is what happened and the hash is all that can find it.
 */
export const SWAP_RESULT_COPY = {
  /** Signed, verified off the receipt and recorded. */
  doneTitle: 'Swap complete',
  /** Where the record is now. The row is written by the record path, not by this view. */
  doneBody: 'It is in your activity now.',

  /** Signed and mined, but the write-up was refused. */
  unrecordedTitle: 'Swapped, not recorded',
  unrecordedBody:
    'Seti could not record this swap, so it may not appear in your activity. Keep this reference.',

  /** The two rows of figures, and the fee under them. */
  paid: 'You paid',
  got: 'You got',
  networkFee: SWAP_COPY.networkFee,

  /** The way back: the page is where the next swap starts. */
  finish: 'Done',
} as const;
