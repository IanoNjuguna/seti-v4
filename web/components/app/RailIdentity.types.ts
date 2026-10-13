/**
 * The handle the signed-in account pays and is paid as, with its public link.
 *
 * `link` and `caption` are both built by `merchant-link.ts` — the ONE place the
 * host and the `/u/` + `/m/` route shapes are stated — from the stored handle
 * column, so the card cannot show one string and copy another.
 */
export interface RailIdentityHandle {
  /** The stored, unique handle — `devrail`, the string every link carries. */
  handle: string;
  /** The full public link. */
  link: string;
  /** The same link as a person reads it — `seti.live/u/devrail`. */
  caption: string;
}

/**
 * The way to claim a name for the mode the account is in and holds none for.
 *
 * `href` comes from `claimHref`, the Profile panel's own builder: one surface
 * claims both kinds, and `?kind=` is what decides which name is being claimed.
 */
export interface RailIdentityClaim {
  href: string;
  label: string;
  title: string;
}

export interface UseRailIdentityReturn {
  /**
   * True only when a session exists.
   *
   * The rail renders for a signed-out visitor too — that is the gate's own rule
   * (a first-time visitor is nobody yet, not half-onboarded) — so the card has to
   * be able to say NOTHING. "Signed in as" over an empty value, offering to claim
   * a name to nobody, is worse than the empty canvas it replaced.
   */
  signedIn: boolean;
  /** The account the session resolves to, or null while unknown. */
  signedInAs: string | null;
  /** The active mode's handle, or null while unknown and when the mode has no name. */
  handle: RailIdentityHandle | null;
  /** Where to go when the mode has no name — null while the names are unknown. */
  claim: RailIdentityClaim | null;
}

export interface CopyLinkButtonProps {
  /** The absolute link that is written to the clipboard. */
  link: string;
  /** The same link without its scheme, shown as the caption. */
  caption: string;
}

export type CopyLinkState = 'idle' | 'copied' | 'failed';

export interface UseCopyLinkReturn {
  state: CopyLinkState;
  copy: () => void;
}
