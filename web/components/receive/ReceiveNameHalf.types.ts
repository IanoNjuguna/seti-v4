/** What the username half needs: the account's string, and the link its code carries. */
export interface ReceiveNameHalfProps {
  /** The bare handle: what a sender types and what the copy control writes. */
  handle: string;
  /** The resolvable link (`seti.live/u/<handle>`) the code encodes and the sheet shares. */
  link: string;
}
