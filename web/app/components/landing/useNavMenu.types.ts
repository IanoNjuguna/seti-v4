import type { RefObject } from 'react';

export interface UseNavMenuReturn {
  /** Whether the mobile menu panel is open. */
  open: boolean;
  /** Open or close, from the bar's control. */
  toggle: () => void;
  /** Close, from a chosen link or the outside tap. */
  close: () => void;
  /** Wraps the control and the panel; a tap outside it dismisses the menu. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** The control, so Escape can hand focus back to the thing that opened it. */
  buttonRef: RefObject<HTMLButtonElement | null>;
}
