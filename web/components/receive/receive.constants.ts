/**
 * Every word the receive halves render.
 *
 * Three receive affordances sit under one switch on `/app/receive`, and that is a
 * real hazard: a username link and an address code look alike and mean different
 * things. The PAGE carries the framing now — its title, the switch's labels
 * (`ReceivePage.constants.ts`) and the lead sentence above whichever half is
 * showing — while the halves carry only the objects: the code, the name, the link.
 * Nothing here explains the surface, because the surface explains itself one level
 * up.
 *
 * The controls' words are the customers': "Copy username" copies the bare name a
 * sender types (no `@`), "Copy link" copies the absolute URL.
 *
 * Never "testnet"/"mainnet" (the database's words) and never a token name (which
 * asset a sender picks is theirs to choose): a person's username is the same name
 * on both networks, so the link works whoever sends it and whenever.
 */
export const RECEIVE_COPY = {
  /** The control beside the handle copies the NAME a sender types, without the `@`. */
  copyHandle: 'Copy username',
  /** The control beside the link copies the absolute URL. */
  copyLink: 'Copy link',
  copiedAction: 'Copied',
  copyFailed: 'Could not copy. Select the text and copy it by hand.',
  /** The code's accessible name, and the SVG's own `<title>`. */
  qrTitle: (handle: string) =>
    `Your Seti link for @${handle}, as a QR code another Seti account can scan.`,
  /** The business half's code: same link shape, different reader — a customer. */
  merchantQrTitle: (name: string) =>
    `Your Seti business link for ${name}, as a QR code a customer can scan.`,
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
