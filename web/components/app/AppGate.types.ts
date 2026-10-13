import type { ReactNode } from 'react';

export interface AppGateProps {
  children: ReactNode;
}

/**
 * What the gate decided to do.
 *
 * A union rather than a set of booleans read in the component's JSX: the decision is
 * the interesting part of this feature and it is pure, so it is stated once, in
 * `gate-decision.ts`, and the component is left with rendering it. Two booleans
 * tested in the markup is how "loading" and "not onboarded" end up rendering the app
 * for one frame.
 */
export type GatePlacement = 'loading' | 'onboarding' | 'shell' | 'redirect-to-onboarding';

/** Everything the decision depends on. Nothing else may affect it. */
export interface GateInput {
  /** The session is still being re-resolved against the server. */
  sessionLoading: boolean;
  /** The caller's handles are still being read. */
  identityLoading: boolean;
  authenticated: boolean;
  /** DERIVED by the server: the account holds at least one handle. */
  onboarded: boolean;
  onOnboardingRoute: boolean;
}
