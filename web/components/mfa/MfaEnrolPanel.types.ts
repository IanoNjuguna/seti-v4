export interface MfaEnrolPanelProps {
  /**
   * Called once Privy has confirmed the method.
   *
   * The panel does not decide what happens next: the gate does, and it re-renders
   * the money step the panel was standing in front of.
   */
  onEnrolled: () => void;
}
