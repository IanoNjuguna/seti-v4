/**
 * Every word the "by name" half of Receive renders.
 *
 * TWO receive affordances sit under one switch on `/app/receive`, and that is a
 * real hazard: a name link and an address code look alike and mean different
 * things. The PAGE carries the framing now — its title, the switch's two labels
 * (`ReceivePage.constants.ts`) and the lead sentence above this card — while the
 * card carries only the objects: the code, the name, the link. Nothing here
 * explains the surface, because the surface explains itself one level up.
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
} as const;
