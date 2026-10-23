/**
 * Every word the receive halves render.
 *
 * The page carried three codes under one switch, and that was a real hazard: a
 * username link and an address code look alike and mean different things. The link
 * row is gone now, and with it the two sentences that only existed to explain it —
 * "A Seti account can also type @handle" had no work to do once the handle was the
 * thing on screen. What is left is one string per half and the four controls around
 * it: copy, share, save, and the failure line each of them owes.
 *
 * The PAGE still carries the framing (its title, the lead sentence, the switch's
 * labels, all in `ReceivePage.constants.ts`). Nothing here explains the surface,
 * because the surface explains itself one level up.
 *
 * The control's word is the customer's: "Copy your username" copies the bare name a
 * sender types, with no `@` — the `@` is how the name is drawn, not part of it.
 *
 * Never "testnet"/"mainnet" (the database's words) and never a token name (which
 * asset a sender picks is theirs to choose): a person's username is the same name on
 * both networks, so it works whoever sends it and whenever.
 */
export const RECEIVE_COPY = {
  /** The round control's accessible name. The glyph alone announces nothing. */
  copyLabel: 'Copy your username',
  /** The announcement once the handle is on the clipboard. */
  copyConfirmed: 'Username copied.',
  copyFailed: 'Could not copy. Select your username above and copy it.',
  share: 'Share',
  shared: 'Shared',
  /**
   * Where the OS sheet is absent and the clipboard took the shareable string
   * instead. It said "Link copied", which named the thing this page no longer
   * shows; what the person needs to know is that it is on the clipboard now.
   */
  sharedByCopy: 'Copied',
  shareFailed: 'Could not share or copy. Select your username above and copy it.',
  /**
   * The code's accessible name, and the SVG's own `<title>`.
   *
   * It must say what scanning the code does, and it is not a description of the
   * payload: the code encodes the resolvable link (`seti.live/u/<handle>`) so any
   * phone camera opens the pay page, while the page itself shows the username. The
   * payload is not the presentation, and naming the link here would put back the
   * one string this change removed.
   */
  qrTitle: (handle: string) =>
    `Your username @${handle}, as a QR code another Seti account can scan.`,
  /** The business half's code: same payload shape, a different reader — a customer. */
  merchantQrTitle: (name: string) => `${name} at your counter, as a QR code a customer can scan.`,
  /**
   * Saving the code. The label says CODE rather than "image", because what the
   * customer does with it is print it onto something — a counter card, a menu, a
   * sticker — and the file that lands in their downloads folder should be the thing
   * they can hand to a printer.
   */
  download: 'Download QR code',
  downloading: 'Preparing…',
  downloadFailed: 'Could not save the code. Take a screenshot of it instead.',
  /** `seti-ian-qr.png` — named for the handle so a folder of codes stays sorted. */
  qrFilename: (handle: string) => `seti-${handle}-qr.png`,
} as const;
