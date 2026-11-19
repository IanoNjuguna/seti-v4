import type { LandingLink } from './Landing.types';

export interface NavMenuPanelProps {
  /** Whether the menu is open. The panel is always mounted so it can transition. */
  open: boolean;
  /** Closes the menu, so a chosen section does not leave it standing over the jump. */
  onNavigate: () => void;
  /**
   * The destinations to list. Defaults to the landing page's own (`MENU_LINKS`), which is
   * what this panel was built for; the marketing bar passes its route links instead (#586),
   * so one disclosure serves both bars rather than two implementations drifting apart.
   */
  links?: LandingLink[];
}
