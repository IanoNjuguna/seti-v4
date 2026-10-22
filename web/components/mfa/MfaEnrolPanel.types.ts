export interface MfaEnrolPanelProps {
  /**
   * Called once Privy has confirmed the method.
   *
   * The panel does not decide what happens next: the gate does, and it re-renders
   * the money step the panel was standing in front of.
   */
  onEnrolled: () => void;
  /**
   * True when the panel sits inside a section that already states its own heading.
   *
   * The panel was written to stand in for a whole step, so it carries a title and a
   * sentence. Rendered under a `ProfileSection` that already says both, that is the same
   * claim twice in two weights, 24px apart, which reads as a mistake rather than as
   * emphasis. Embedded, the panel keeps the choices and drops the header.
   */
  embedded?: boolean;
}
