/**
 * The identity the tile is about.
 *
 * `handle`, `link` and `caption` all come from `useRailIdentity` — the same source
 * the rail's identity card copies from — so the string on the tile, the string in
 * the code and the string on the clipboard are one string. This component never
 * builds a URL: `merchant-link.ts` is the only place the host and the route shapes
 * are stated.
 */
export interface ReceiveLinkPanelProps {
  /** The stored handle, rendered with its `@`. */
  handle: string;
  /** The absolute public link, and the value the copy control writes. */
  link: string;
  /** The same link as a person reads it — `seti.live/u/devrail`. */
  caption: string;
}

/** The handle and link the tile renders, or the reason it renders nothing. */
export interface ReceiveIdentity {
  handle: string;
  link: string;
  caption: string;
}
