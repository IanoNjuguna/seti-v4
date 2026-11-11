import type { IconName } from './icon-paths.constants';

/** How the control reads once it has done its job. */
export type IconButtonTone = 'default' | 'confirmed';

/** Which canvas the control sits on — the rail is black, an app card is white. */
export type IconButtonSurface = 'light' | 'dark';

/** The shape the control is drawn in: a resting `soft` circle, or a bare glyph. */
export type IconButtonWell = 'soft' | 'none';

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
  /**
   * The shape the control is drawn in.
   *
   * `soft` (default) is the `surface-soft` circle: a control that stands on its own.
   * `none` keeps the 44px hit area and drops the paint in every state, for a glyph that
   * belongs to a line of type rather than to the page — the copy action at the end of a
   * value. See `IconButton` for why the two are one component.
   */
  well?: IconButtonWell;
  /**
   * The control cannot act right now, and says so rather than accepting the press and doing
   * nothing (the swap page's flip, #421). `Button` has carried this for the same reason; an
   * icon-only control is where "it did nothing when I pressed it" is hardest to diagnose.
   */
  disabled?: boolean;
  className?: string;
}
