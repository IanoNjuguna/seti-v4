import type { RefObject } from 'react';

export interface NavMenuButtonProps {
  /** Whether the panel is open; the control states it with `aria-expanded`. */
  open: boolean;
  /** The control's one action: `useNavMenu`'s toggle. */
  onToggle: () => void;
  /** The panel's id, for `aria-controls`. */
  panelId: string;
  /** Handed in so `useNavMenu` can return focus here on Escape. */
  buttonRef: RefObject<HTMLButtonElement | null>;
}
