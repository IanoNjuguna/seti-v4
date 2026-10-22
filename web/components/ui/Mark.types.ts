export type MarkTone = 'primary' | 'primary-deep' | 'charcoal' | 'accent-blue-link' | 'accent-brown';

export type MarkSize = 'lg' | 'md' | 'sm';

export interface MarkProps {
  /** The account's name, when it has one. Initials come from here. */
  handle?: string | null;
  /**
   * The wallet address, used ONLY when the account has no name yet: the mark is generated
   * from the username, so the address is the fallback seed rather than a second one.
   */
  address?: string | null;
  size?: MarkSize;
  className?: string;
}
