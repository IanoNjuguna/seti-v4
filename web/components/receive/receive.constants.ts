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
  /**
   * The row labels (#549). The page shows one of two strings and, until these existed,
   * nothing on it said which. The switch above names the choice; these name the VALUE,
   * which is what a reader arriving mid-page needs, and they are the same words the
   * switch uses so the two cannot drift.
   */
  usernameLabel: 'Username',
  merchantNameLabel: 'Merchant name',
  /** The bare control's accessible name. The glyph alone announces nothing. */
  copyLabel: 'Copy your username',
  /** The announcement once the handle is on the clipboard. */
  copyConfirmed: 'Username copied.',
  copyFailed: 'Could not copy. Select your username above and copy it.',

  /**
   * The merchant half's copy control (#549). It writes the HANDLE, not the business name:
   * the name is what the customer reads and the handle is what the code, the link and the
   * saved file are built from. The row prints both, so the control copies something the
   * reader can see.
   */
  merchantCopyLabel: 'Copy your merchant username',
  merchantCopyConfirmed: 'Merchant username copied.',
  merchantCopyFailed: 'Could not copy. Select your merchant username above and copy it.',

  /**
   * The address block (#419).
   *
   * A bridge, a CEX withdrawal or another wallet has no username to send to, so the
   * account's address is printed under the code and the name. The label names the CHAIN,
   * not the network mode: `testnet` and `mainnet` are the database's words, and this page
   * never says them.
   *
   * The note states the consequence rather than a polite reminder. A send on the wrong
   * network is lost money, and "check your network" is a sentence a customer reads after
   * the mistake; this one is read at the moment they copy.
   */
  addressLabel: (chain: string) => `Your address on ${chain}`,
  addressCopyLabel: 'Copy your address',
  addressCopied: 'Address copied.',
  addressCopyFailed: 'Could not copy. Select the address above and copy it.',
  addressNote: (chain: string) =>
    `Only ${chain} assets can arrive here. Anything sent on another network is lost.`,
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
