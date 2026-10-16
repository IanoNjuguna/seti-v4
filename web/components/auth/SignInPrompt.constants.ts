export const SIGN_IN_PROMPT_COPY = {
  /**
   * One word per the button rules, and the same word the app uses everywhere —
   * "sign in" is the only verb for asking, never "connect" and never a wallet.
   *
   * The prompt carries no failure copy of its own any more: it does not start a
   * sign-in, so it has nothing to fail at. A reason a restore or a previous attempt
   * failed belongs to the surface that owns that attempt, and the door itself
   * reports its own errors.
   */
  action: 'Sign in',
} as const;
