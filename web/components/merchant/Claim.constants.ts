/**
 * Copy for the claim surface.
 *
 * Plain and specific, per the repo's tone rules: "Sign & claim" is the action,
 * and every error names the cause and the fix rather than saying "invalid".
 */
export const CLAIM_COPY = {
  title: 'Claim a business name',
  intro:
    'Sign once with the wallet that receives your payments. This attaches the name to that address — nothing is written on chain and it costs no gas.',
  fieldLabel: 'Business name',
  placeholder: 'Java House',
  hint: "2–64 characters: letters, digits, spaces and . , ' & ( ) - _ +",
  submit: 'Sign & claim',
  signing: 'Waiting for your wallet to sign…',
  submitting: 'Saving your claim…',
  resultTitle: 'Claimed',
  again: 'Claim another name',
  verified: 'Verified',
  unverified: 'Not verified',
  errorTitle: 'Name not claimed',
  /** The label above the shareable link a merchant hands to a customer. */
  linkLabel: 'Your link',
  /** The link preview while the backend is being asked whether it is free. */
  handleChecking: 'Checking whether this link is free…',
  /** A free link is a quiet confirmation, not a headline. */
  handleFree: 'Free',
  /**
   * A taken link, named with its current holder. This is the whole reason the
   * preview exists: a link that reduces to one another merchant already holds
   * would resolve ambiguously, so it has to be caught while the name is being
   * edited — not when a customer scans a sticker.
   */
  handleTaken: (handle: string, holder: string): string =>
    `seti.live/m/${handle} is already taken by ${holder}. Names that reduce to the same link cannot both be claimed — choose another name.`,
  /** The sticker QR. */
  qrLabel: 'Print this — your sticker',
  qrHint:
    'The code opens your link. No amount is in it, so the customer enters what they are paying.',
  qrDownload: 'Download QR (SVG)',
} as const;
