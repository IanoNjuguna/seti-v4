'use client';

import { useCallback, useState } from 'react';
import type { UseTermsAcceptanceReturn } from './useTermsAcceptance.types';

/**
 * Whether the customer has accepted the Terms of Use at sign-up.
 *
 * Deliberately not persisted and deliberately not defaulted to true: the
 * acceptance has to be given in this session, by this person, before the sign-in
 * controls will act. One owner of the flag (`SignInCard`) reads it, so the gate
 * cannot drift between the two ways in (`dev` and `privy`).
 *
 * A hook rather than a `useState` inside the card so the gate is testable on its
 * own and the card stays a view (see `modular-ui-authoring`).
 */
export function useTermsAcceptance(): UseTermsAcceptanceReturn {
  const [accepted, setAccepted] = useState(false);

  const set = useCallback((next: boolean) => {
    setAccepted(next);
  }, []);

  return { accepted, setAccepted: set };
}
