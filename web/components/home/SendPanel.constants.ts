/**
 * Copy for the send panel, in one place so the form, the summary and the receipt
 * cannot drift apart.
 *
 * `KEPT` is the note that replaced the old "not recorded" warning. It is the
 * same slot for the same reason: a send moves real money, and the customer is
 * told what happens to the fee *before* they sign — except now the answer is
 * "Seti takes 2%", which only became true when the fee leg was wired up.
 */
export const SEND_COPY = {
  recipientLabel: 'Their address or username',
  recipientHint: 'A 0x address, or a Seti username like javahouse.',
  /** Only used before the dashboard's currency reaches the panel. */
  amountLabelFallback: 'Amount',
  amountHint: 'They receive this exact amount.',
  submit: 'Send',
  receiptTitle: 'Transfer sent',
  another: 'Send another',
  /** Same two wallet states `ReceiveAddressPanel` names, in the same words. */
  findingWallet: 'Finding your wallet…',
  noWallet: 'No wallet yet. Sign in with Privy and one is created for you.',
  /** What the fee is, and that it is taken — charged once, no separate approval. */
  feeNote: 'The platform fee is charged once, in the same transaction as the transfer.',
} as const;

/** Step → what the customer is waiting on. Calm, specific, no exclamation marks. */
export const SEND_PROGRESS: Partial<Record<string, string>> = {
  previewing: 'Pricing the transfer…',
  signing: 'Confirm in your wallet…',
  recording: 'Recording the transfer…',
};

/**
 * The resolved recipient, shown before anything is signed.
 *
 * A username is only how the customer FOUND the person; the address is what gets
 * signed. Naming both, together, is what stops a name silently becoming an
 * address the customer never saw.
 */
export const SEND_RESOLVED_COPY = {
  label: 'Sending to',
  verified: 'Name verified',
  unverified: 'Name not verified',
  addressNote: 'The money goes to this address.',
} as const;
