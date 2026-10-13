/** Props for the Privy sign-in control. */
export interface PrivySignInButtonProps {
  /**
   * Set while a gate upstream is not satisfied — the terms checkbox at sign-up.
   * The button is genuinely disabled, not merely guarded, so no click, Enter or
   * Space can start a sign-in behind the gate.
   */
  disabled?: boolean;
}
