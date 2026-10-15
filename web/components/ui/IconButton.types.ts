import type { IconName } from './icon-paths.constants';

/** How the control reads once it has done its job. */
export type IconButtonTone = 'default' | 'confirmed';

/** Which canvas the control sits on — the rail is black, an app card is white. */
export type IconButtonSurface = 'light' | 'dark';

export interface IconButtonProps {
  /** The glyph to draw. A caller swapping it on state is the point of the control. */
  name: IconName;
  /**
   * The control's accessible name, in the customer's words.
   *
   * Required, and not derived from `name`: an icon-only control has no visible
   * label, so this is the only thing a screen reader — or a pointer hovering it —
   * can be told about what it does.
   */
  label: string;
  onClick: () => void;
  /** `confirmed` paints the glyph in the success accent, for a completed action. */
  tone?: IconButtonTone;
  /**
   * `dark` is the rail's version: no fill, `on-dark-mute` glyph, and a lift to
   * `surface-deep` on hover. A `surface-soft` circle on the black rail would be a
   * bright chip competing with the brand, not a quiet control.
   */
  surface?: IconButtonSurface;
  className?: string;
}
