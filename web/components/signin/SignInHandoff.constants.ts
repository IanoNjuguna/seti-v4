/**
 * Copy for the post-sign-in transition, and the floor under it.
 *
 * The words state the OUTCOME, which is the only thing the customer needs and
 * the only thing this screen honestly knows. It says nothing about the mechanism
 * ("Opening…", "Redirecting…"), it does not name Seti inside a Seti screen, and
 * it carries no ellipsis: a trailing "…" on a screen that is already gone reads
 * as a shrug, and the approved line is the outcome in sentence case.
 *
 * Four words rather than three is deliberate: "You are in" is shorter and
 * ambiguous about where, and the whole point of the line is to remove the doubt
 * the wait creates.
 *
 * `SIGN_IN_HANDOFF_DELAY_MS` is the floor from the same decision. A client-side
 * navigation usually completes in well under this, so the handoff normally draws
 * nothing at all — a splash that flashes is worse than a brief blank, and a
 * screen nobody can read is worse than no screen. Only a wait long enough to be
 * noticed earns the words, the mark and the line.
 */
export const SIGN_IN_HANDOFF_COPY = {
  /**
   * The rail spells this inline (`AppRail.tsx`); one brand constant shared by
   * both would be the neat fix and belongs to the chrome, not to this pass.
   */
  wordmark: 'Seti',
  line: 'You are signed in',
} as const;

export const SIGN_IN_HANDOFF_DELAY_MS = 300;
