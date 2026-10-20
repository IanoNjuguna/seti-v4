export interface MfaGateValue {
  /**
   * True when this account has no second factor and the gate is armed.
   *
   * False in three different situations that the caller must not need to tell
   * apart: the gate is disarmed, nobody is signed in, or the account already has a
   * method. All three mean "render the money step as usual".
   */
  required: boolean;
  /**
   * Called by the enrolment panel once a method is confirmed.
   *
   * Privy does return the updated user, but this makes the step change immediate
   * rather than dependent on a re-render arriving with the new `mfaMethods` list:
   * a customer who just enrolled must not be shown the enrolment screen again
   * because a state update was still in flight.
   */
  markEnrolled: () => void;
}
