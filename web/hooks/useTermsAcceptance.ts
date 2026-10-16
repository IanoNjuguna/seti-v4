'use client';

import { useCallback, useState } from 'react';
import type { UseTermsAcceptanceReturn } from './useTermsAcceptance.types';

/**
 * Whether the customer has accepted the Terms of Use at sign-up.
 *
 * Deliberately not persisted and deliberately not defaulted to true: the
 * acceptance has to be given in this session, by this person, before the sign-in
 * controls will act. Its ONE owner is the sign-in page's hook (`useSignInScreen`),
 * which gates the submit control on this flag AND passes the accepted version into
 * both session calls — so the gate and the version recorded for it cannot drift.
 *
 * A hook rather than a `useState` inside the page so the gate is testable on its
 * own and the page stays a view (see `modular-ui-authoring`).
 */
export function useTermsAcceptance(): UseTermsAcceptanceReturn {
  const [accepted, setAccepted] = useState(false);

  const set = useCallback((next: boolean) => {
    setAccepted(next);
  }, []);

  return { accepted, setAccepted: set };
}
