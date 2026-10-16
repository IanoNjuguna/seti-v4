export interface NavMenuPanelProps {
  /** Whether the menu is open. The panel is always mounted so it can transition. */
  open: boolean;
  /** Closes the menu, so a chosen section does not leave it standing over the jump. */
  onNavigate: () => void;
}
