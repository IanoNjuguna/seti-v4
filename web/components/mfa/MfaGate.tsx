'use client';

import type { ReactNode } from 'react';
import { useMfaGate } from '@/hooks/useMfaGate';
import { MfaEnrolPanel } from './MfaEnrolPanel';

/**
 * Wrap a step that can move money in this, and an account with no second factor
 * never reaches it.
 *
 * A wrapper rather than a check inside each step, because the check has to hold for
 * EVERY way into the money movement, and the next entry point added should be a line
 * of JSX around it rather than a copy of this reasoning. Today that is both branches
 * of `SendSteps` — a person's send panel and a merchant's amount step — which is the
 * only place a signature is ever built.
 *
 * With the gate disarmed (`MFA_ENROLLMENT_ENFORCED`) this renders its children
 * unchanged and does nothing else, which is why it can be wired in before the feature
 * is armed.
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const { required, markEnrolled } = useMfaGate();

  if (!required) return <>{children}</>;

  return <MfaEnrolPanel onEnrolled={markEnrolled} />;
}
