export type MarkTone = 'primary' | 'primary-deep' | 'charcoal' | 'accent-blue-link' | 'accent-brown';

export type MarkSize = 'lg' | 'md' | 'sm';

export interface MarkProps {
  /** The account's name, when it has one. Initials come from here. */
  handle?: string | null;
  /**
   * The wallet address. Used ONLY to pick the tone, so two accounts that share initials
   * still look different, and so the tone never changes when a handle is renamed.
   */
  address?: string | null;
  size?: MarkSize;
  className?: string;
}
