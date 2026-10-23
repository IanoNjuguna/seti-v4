import type { Audience } from './Audience.types';

export interface NavMenuPanelProps {
  /** Whether the menu is open. The panel is always mounted so it can transition. */
  open: boolean;
  /** Closes the menu, so a chosen section does not leave it standing over the jump. */
  onNavigate: () => void;
  /**
   * The reader the page is rendering for, so the panel can carry the
   * Personal | Business selector: below `md` this panel is the ONLY place the
   * control exists, and a page whose audience cannot be changed on a phone is a
   * selector that only works on a laptop.
   */
  audience: Audience;
}
