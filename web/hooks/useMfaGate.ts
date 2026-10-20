'use client';

import { useCallback, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { PRIVY_APP_ID } from '@/components/providers/PrivyAppProvider.constants';
import { MFA_ENROLLMENT_ENFORCED } from '@/lib/mfa/mfa.constants';
import { hasMfaMethod } from '@/lib/mfa/mfa';
import type { MfaGateValue } from './useMfaGate.types';

/**
 * Whether the money step in front of this component has to be replaced by the
 * enrolment screen.
 *
 * ## The decision, in one place
 *
 * `required` asks two things: is the gate armed (`MFA_ENROLLMENT_ENFORCED`), and does
 * THIS account have a method (`hasMfaMethod`)? Everything else — which step renders,
 * what the screen says, what happens after enrolment — is the caller's business.
 *
 * `markEnrolled` is local state rather than a read of Privy's user object, because
 * the object arrives on Privy's schedule, not on the customer's: someone who has just
 * finished a passkey dialog must not be shown the same screen again for a render or
 * two. The read stays the source of truth for a NEW page load, which is the case that
 * matters (a method enrolled in another tab, or yesterday).
 *
 * ## Module scope, not a runtime guard
 *
 * `usePrivy` throws outside a provider, and this app is expected to run with no Privy
 * app configured at all (`resolveAuthSource` explains the `dev` source). The same rule
 * `useEmbeddedWallet` and `usePrivyEmailSignIn` follow applies here: pick the
 * implementation once, at module scope, on the app id. A build with no id reports
 * `required: false` and renders nothing extra — a dev build cannot be blocked from
 * sending by a feature it has no provider for.
 */
function useMfaGateImpl(): MfaGateValue {
  const { user, authenticated } = usePrivy();
  const [enrolledHere, setEnrolledHere] = useState(false);

  const markEnrolled = useCallback(() => setEnrolledHere(true), []);

  const required =
    MFA_ENROLLMENT_ENFORCED && authenticated && !enrolledHere && !hasMfaMethod(user);

  return { required, markEnrolled };
}

function useMfaGateNoop(): MfaGateValue {
  const markEnrolled = useCallback(() => undefined, []);
  const required = false;
  return { required, markEnrolled };
}

export const useMfaGate: () => MfaGateValue = PRIVY_APP_ID ? useMfaGateImpl : useMfaGateNoop;
